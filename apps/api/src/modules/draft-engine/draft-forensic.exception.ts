import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Custom forensic exception to ensure detailed context and original stack traces
 * are preserved and correctly handled by the GlobalExceptionFilter.
 */
export class DraftForensicException extends HttpException {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    const errorMsg = cause instanceof Error ? cause.message : String(cause || message);
    const errorStack = cause instanceof Error ? cause.stack : undefined;
    
    super(
      {
        error: {
          code: "DRAFT_FORENSIC_ERROR",
          message,
          details: {
            ...details,
            originalError: cause ? {
              message: errorMsg,
              stack: errorStack,
            } : undefined,
          },
        },
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    if (cause instanceof Error && cause.stack) {
      this.stack = cause.stack;
    }
  }
}
