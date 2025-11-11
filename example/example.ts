import { ImageProcessor } from "../dist/index.js";

async function runExample() {
  const processor = new ImageProcessor(
    {
      // Required parameters
      endpointUrl: "http://localhost:9000",
      accessKeyId: "minioadmin",
      secretAccessKey: "minioadmin",
      region: "us-east-1",
      sourceBucket: "test-bucket",
      sourcePath: "test-images/sample-image.jpg",
      destinationBucket: "test-bucket",
      destinationPath: "output/",
      aesKey: "fedcba9876543210fedcba9876543210",
      aesIv: "fedcba9876543210fedcba9876543210",

      // Optional parameters with defaults
      containerImage: "localhost/image-to-dash:latest",
      maxRetries: 3,
      retryDelay: 1000,
      clearLead: 0,
    },
    {
      // Event handlers
      onStart: () => console.log("Processing started..."),
      onSuccess: (output) => console.log("Processing succeeded:", output),
      onError: (error) => console.error("Error:", error.message),
      onRetry: (attempt, error) =>
        console.log(`Retry attempt ${attempt}: ${error.message}`),
    }
  );

  try {
    console.log("Starting image processing...");
    const startTime = Date.now();
    const result = await processor.process();
    const executionTime = Date.now() - startTime;
    console.log(`Execution time: ${executionTime}ms`);
    console.log("Process completed:", result);
  } catch (error) {
    console.error("Process failed:", error);
  } finally {
    // Clean up resources
    await processor.stop();
  }
}

// Run the example
runExample().catch(console.error);
