import type { ImageToDashOptions, ImageToDashEvents, ProcessResult } from "./types.js";
export declare class ImageToDash {
    private options;
    private events;
    private containerProcess;
    private isProcessing;
    private currentAttempt;
    constructor(options: ImageToDashOptions, events?: ImageToDashEvents);
    /**
     * Start the image processing
     */
    process(filename: string, contentId: string): Promise<ProcessResult>;
    private processWithRetry;
    /**
     * Stop the current processing
     */
    stop(): Promise<void>;
    private runContainer;
}
