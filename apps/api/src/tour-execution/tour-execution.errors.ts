export class TourExecutionHttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = "TourExecutionHttpError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isTourExecutionHttpError(error: unknown): error is TourExecutionHttpError {
  return error instanceof TourExecutionHttpError;
}
