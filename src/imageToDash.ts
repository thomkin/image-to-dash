import { execa, type ExecaChildProcess } from "execa";
import { fileURLToPath } from "url";

import * as fs from "fs/promises";
import * as path from "path";
import type {
  ImageToDashOptions,
  ImageToDashEvents,
  ProcessResult,
} from "./types.js";

export class ImageToDash {
  private options: Required<ImageToDashOptions>;
  private events: ImageToDashEvents;
  private containerProcess: ExecaChildProcess | null = null;
  private isProcessing = false;
  private currentAttempt = 0;

  constructor(options: ImageToDashOptions, events: ImageToDashEvents = {}) {
    this.options = {
      region: "us-east-1",
      clearLead: 0,
      maxRetries: 3,
      retryDelay: 1000,
      containerImage: "localhost/image-to-dash:latest",
      ...options,
    };
    this.events = events;
  }

  /**
   * Start the image processing
   */
  public async process(filename: string): Promise<ProcessResult> {
    const events = {
      onStart: () => this.events.onStart?.(),
      onSuccess: (output: string) => this.events.onSuccess?.(output),
      onError: (error: Error) => this.events.onError?.(error),
      onRetry: (attempt: number, error: Error) =>
        this.events.onRetry?.(attempt, error),
    };

    return this.processWithRetry(events, filename);
  }

  private async processWithRetry(
    events: Required<ImageToDashEvents>,
    filename: string
  ): Promise<ProcessResult> {
    events.onStart();
    this.isProcessing = true;
    this.currentAttempt = 0;
    let lastError: Error | null = null;

    while (this.currentAttempt <= this.options.maxRetries) {
      console.log("Thomas: in the while loop");
      try {
        console.log("Before the run container");
        const result = await this.runContainer();
        console.log("After the run container", result);
        if (result.success) {
          // Success case
          events.onSuccess?.(result.output || "");
          this.isProcessing = false;
          return {
            success: true,
            output: result.output,
            attempts: this.currentAttempt + 1, // +1 because we count the initial attempt
          };
        } else {
          // Container ran but returned an error
          lastError = result.error || new Error("Container execution failed");
        }
      } catch (error) {
        // Uncaught error from runContainer
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Check if we should retry
      console.log(
        "Thomas: should we retry?",
        this.currentAttempt,
        this.options.maxRetries
      );
      if (this.currentAttempt < this.options.maxRetries) {
        events.onRetry?.(this.currentAttempt, lastError!);
        console.log("Thomas: we should retry", this.options.retryDelay);
        await new Promise((resolve) =>
          setTimeout(resolve, this.options.retryDelay)
        );
        console.log(
          "Thomas: we waited for the retry delay",
          this.options.retryDelay
        );
        this.currentAttempt++;
      } else {
        // No more retries left
        break;
      }
    }

    // If we get here, we've exhausted all retries
    const finalError = lastError || new Error("Max retries reached");
    events.onError?.(finalError);
    this.isProcessing = false;

    return {
      success: false,
      error: finalError,
      attempts: this.currentAttempt + 1, // +1 because we count the initial attempt
    };
  }

  /**
   * Stop the current processing
   */
  public async stop(): Promise<void> {
    if (this.containerProcess) {
      this.containerProcess.kill("SIGTERM", {
        forceKillAfterTimeout: 5000,
      });
      this.containerProcess = null;
    }
    this.isProcessing = false;
  }

  private async runContainer(): Promise<ProcessResult> {
    const {
      endpointUrl,
      accessKeyId,
      secretAccessKey,
      region,
      sourceBucket,
      sourcePath,
      destinationBucket,
      destinationPath,
      aesKey,
      aesIv,
      clearLead,
      containerImage,
    } = this.options;

    const sourceUri = `s3://${sourceBucket}/${sourcePath}`;
    const destUri = `s3://${destinationBucket}/${destinationPath}`;

    try {
      // Create a temporary directory for the workflow script
      const tempDir = await fs.mkdtemp("/tmp/image-to-dash-");
      const workflowScriptPath = path.join(tempDir, "workflow.sh");

      // Get the directory name of the current module
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      // Copy the workflow script to the temporary directory
      const workflowScriptSource = path.resolve(
        process.cwd(),
        "podman_workflow.sh"
      );
      await fs.copyFile(workflowScriptSource, workflowScriptPath);
      await fs.chmod(workflowScriptPath, 0o755);

      const args = [
        "run",
        "--rm",
        "--network=host",
        "--memory=256m",
        "--memory-swap=256m",
        "-e",
        `AWS_ACCESS_KEY_ID=${accessKeyId}`,
        "-e",
        `AWS_SECRET_ACCESS_KEY=${secretAccessKey}`,
        "-e",
        `AWS_DEFAULT_REGION=${region}`,
        "-e",
        `AWS_ENDPOINT_URL=${endpointUrl}`,
        "-v",
        `${workflowScriptPath}:/app/workflow.sh:ro`,
        containerImage,
        "/app/workflow.sh",
        sourceUri,
        destUri,
        aesIv,
        aesKey,
        String(clearLead),
        `run-${Date.now()}`,
      ];

      this.containerProcess = execa("podman", args, {
        stdio: ["inherit", "pipe", "pipe"],
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: accessKeyId,
          AWS_SECRET_ACCESS_KEY: secretAccessKey,
          AWS_DEFAULT_REGION: region,
        },
      });

      const result = await this.containerProcess;

      return {
        success: true,
        output: result.stdout,
        attempts: this.currentAttempt,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        attempts: this.currentAttempt,
      };
    }
  }
}
