export const VALIDATION_QUEUE_SATURATED = "VALIDATION_QUEUE_SATURATED";

export class ValidationQueueSaturatedError extends Error {
  readonly code = VALIDATION_QUEUE_SATURATED;

  constructor(public readonly maxDepth: number) {
    super(VALIDATION_QUEUE_SATURATED);
    this.name = "ValidationQueueSaturatedError";
  }
}

export function isValidationQueueSaturatedError(
  error: unknown
): error is ValidationQueueSaturatedError {
  return error instanceof ValidationQueueSaturatedError;
}
