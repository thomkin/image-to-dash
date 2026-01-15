export interface ImageToDashOptions {
    /** MinIO/S3 endpoint URL */
    endpointUrl: string;
    /** AWS access key ID */
    accessKeyId: string;
    /** AWS secret access key */
    secretAccessKey: string;
    /** AWS region */
    region?: string;
    /** Source bucket name */
    sourceBucket: string;
    /** Source image path in the bucket */
    sourcePath: string;
    /** Destination bucket name */
    destinationBucket: string;
    /** Destination path in the bucket */
    destinationPath: string;
    /** AES encryption key (32 bytes) */
    aesKey: string;
    /** AES initialization vector (16 bytes) */
    aesIv: string;
    /** Number of seconds of clear content before encryption starts */
    clearLead?: number;
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Delay between retries in milliseconds */
    retryDelay?: number;
    /** Container image name */
    containerImage?: string;
}
export interface ImageToDashEvents {
    /** Called when processing starts */
    onStart?: () => void;
    /** Called when processing completes successfully */
    onSuccess?: (output: string) => void;
    /** Called when an error occurs */
    onError?: (error: Error) => void;
    /** Called when a retry is attempted */
    onRetry?: (attempt: number, error: Error) => void;
}
export interface ProcessResult {
    /** Whether processing was successful */
    success: boolean;
    /** Error message if processing failed */
    error?: Error;
    /** Output from the container */
    output?: string;
    /** Number of attempts made */
    attempts: number;
}
