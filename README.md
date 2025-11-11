# Image to DASH Converter

A TypeScript library for processing images to DASH format using Podman containers.

## Features

- Process images to DASH format using Podman
- Configurable retry logic with exponential backoff
- Event-based callbacks for monitoring progress
- TypeScript support with full type definitions
- Works with MinIO/S3-compatible storage

## Installation

```bash
# Using pnpm (recommended)
pnpm add image-to-dash
```

## Usage

```typescript
import { ImageProcessor } from "image-to-dash";

// Create a new instance of ImageProcessor
const processor = new ImageProcessor({
  containerImage: "your-container-image", // Name of the container image with the processing script
  minioEndpoint: "http://localhost:9000", // MinIO server endpoint
  minioAccessKey: "minioadmin", // MinIO access key
  minioSecretKey: "minioadmin", // MinIO secret key
  minioBucket: "test-bucket", // Bucket to store processed files
  aesKey: "your-32-byte-aes-key-123456", // 32-byte AES key for encryption
  keyId: "1", // Key ID for the encryption key
  iv: "1234567890123456", // 16-byte IV for encryption
  maxRetries: 3, // Maximum number of retry attempts
  retryDelay: 1000, // Delay between retries in milliseconds
});

// Set up event handlers
processor.onStart = () => console.log("Processing started...");
processor.onSuccess = (output) => console.log("Processing succeeded:", output);
processor.onError = (error) => console.error("Error:", error.message);
processor.onRetry = (attempt, error) =>
  console.log(`Retry attempt ${attempt}: ${error.message}`);

// Process an image
async function processImage(filename: string) {
  try {
    const result = await processor.process(filename);
    console.log("Process result:", result);
    return result;
  } catch (error) {
    console.error("Process failed:", error);
    throw error;
  }
}

// Example usage
processImage("example.jpg").catch(console.error);
```

## API

### `new ImageProcessor(options: ImageProcessorOptions)`: ImageProcessor

Creates a new instance of the ImageProcessor.

#### Options:

- `containerImage` (string): The name of the container image to use for processing.
- `minioEndpoint` (string): The URL of the MinIO server.
- `minioAccessKey` (string): The access key for the MinIO server.
- `minioSecretKey` (string): The secret key for the MinIO server.
- `minioBucket` (string): The name of the bucket to use for storing processed files.
- `aesKey` (string): A 32-byte AES key used for encryption.
- `keyId` (string): The ID of the encryption key.
- `iv` (string): A 16-byte initialization vector for encryption.
- `maxRetries?` (number, optional): Maximum number of retry attempts (default: 3).
- `retryDelay?` (number, optional): Delay between retries in milliseconds (default: 1000).

### Methods

#### `process(filename: string): Promise<ProcessResult>`

Processes the specified image file.

- `filename`: The name of the file to process.
- Returns: A promise that resolves to a `ProcessResult` object.

### Events

#### `onStart?: () => void`

Called when processing starts.

#### `onSuccess?: (output: string) => void`

Called when processing completes successfully.

#### `onError?: (error: Error) => void`

Called when an error occurs during processing.

#### `onRetry?: (attempt: number, error: Error) => void`

Called before a retry attempt is made.

## Building from Source

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/image-to-dash.git
   cd image-to-dash
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Build the project:

   ```bash
   pnpm run build
   ```

4. Run tests:
   ```bash
   pnpm test
   ```

## License

MIT
