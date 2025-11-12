import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execa } from "execa";

import ImageToDash from "../src/index.ts";

// Mock execa
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

// Mock fs
vi.mock("fs/promises", () => ({
  mkdtemp: vi.fn().mockResolvedValue("/tmp/test-dir"),
  copyFile: vi.fn().mockResolvedValue(undefined),
  chmod: vi.fn().mockResolvedValue(undefined),
}));

describe("ImageProcessor", () => {
  const options = {
    endpointUrl: "http://localhost:9000",
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
    sourceBucket: "test-bucket",
    sourcePath: "source/test.jpg",
    destinationBucket: "test-bucket",
    destinationPath: "output/",
    aesKey: "test-aes-key-1234567890123456",
    aesIv: "1234567890123456",
    containerImage: "test-image",
    maxRetries: 1, // Reduce max retries for faster tests
    retryDelay: 0, // No delay for tests
  };

  let processor: ImageToDash;
  let events: any;

  beforeEach(() => {
    // Clear all mocks and timers before each test
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Set up default event handlers
    events = {
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
      onRetry: vi.fn(),
    };

    // Create a new processor instance with default options
    processor = new ImageToDash(
      {
        ...options,
        maxRetries: 1, // Default to 1 retry for tests
        retryDelay: 10, // Small delay for testing
      },
      events
    );

    // Ensure fake timers are enabled before each test
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Clean up timers after each test
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("should initialize with default values", () => {
    expect(processor).toBeInstanceOf(ImageToDash);
  });

  describe("process", () => {
    it("should retry on failure", async () => {
      const mockExeca = vi.mocked(execa);

      // First call fails, second call succeeds
      mockExeca
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce({
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn((event, callback) => {
            if (event === "exit") {
              callback(0);
            }
            return { on: vi.fn() };
          }),
        } as any);

      // Start processing
      const processPromise = processor.process("test.jpg", "test-content-id");

      // Fast-forward time to skip the retry delay
      await vi.runAllTimersAsync();

      // Wait for the process to complete
      await processPromise;

      // Verify onRetry was called with attempt 0 (0-based index)

      expect(events.onRetry).toHaveBeenCalledTimes(1);
      expect(events.onRetry).toHaveBeenCalledWith(0, expect.any(Error));
      expect(mockExeca).toHaveBeenCalledTimes(2);
    });

    it("should fail after max retries", async () => {
      // Mock execa to reject with an error on all calls
      const mockExeca = vi.mocked(execa);
      const error = new Error("Permanent failure");

      // Track execa calls
      const execaCalls: any[] = [];
      mockExeca.mockImplementation((...args) => {
        execaCalls.push(args);
        console.log("execa called with args:", args);
        return Promise.reject(error) as any;
      });

      // Set up event spies
      const onStartSpy = vi.fn(() => console.log("onStart called"));
      const onRetrySpy = vi.fn((attempt, err) =>
        console.log(
          `onRetry called with attempt ${attempt} and error:`,
          err.message
        )
      );
      const onErrorSpy = vi.fn((err) =>
        console.log("onError called with error:", err.message)
      );

      // Create a new processor with our spies and minimal retry delay
      const testProcessor = new ImageToDash(
        {
          ...options,
          maxRetries: 4, // 4 retries for this test (5 attempts total)
          retryDelay: 10, // 10ms delay for testing
        },
        {
          onStart: onStartSpy,
          onRetry: onRetrySpy,
          onError: onErrorSpy,
        }
      );

      // Start the process
      const processPromise = testProcessor.process(
        "test.jpg",
        "test-content-id"
      );

      // Fast-forward time to cover all retries (4 retries * 10ms = 40ms, plus some buffer)
      await vi.runAllTimersAsync();

      // Wait for the process to complete
      const result = await processPromise;

      // Verify the result indicates failure
      expect(result).toEqual({
        success: false,
        error: expect.any(Error),
        attempts: 5, // 1 initial + 4 retries
      });
      expect(result.error?.message).toContain("Permanent failure");

      // Verify events were called as expected
      expect(onStartSpy).toHaveBeenCalledTimes(1);
      expect(onRetrySpy).toHaveBeenCalledTimes(4); // Should retry 4 times
      expect(onErrorSpy).toHaveBeenCalledTimes(1);

      // Verify execa was called the expected number of times (initial + 4 retries)
      expect(mockExeca).toHaveBeenCalledTimes(5);

      // Verify the retry attempts were made with the correct attempt numbers (0-based index)
      expect(onRetrySpy).toHaveBeenNthCalledWith(1, 0, expect.any(Error));
      expect(onRetrySpy).toHaveBeenNthCalledWith(2, 1, expect.any(Error));
      expect(onRetrySpy).toHaveBeenNthCalledWith(3, 2, expect.any(Error));
      expect(onRetrySpy).toHaveBeenLastCalledWith(3, expect.any(Error));

      // Ensure the process was properly cleaned up
      expect(testProcessor["isProcessing"]).toBe(false);
    });
  });
});
