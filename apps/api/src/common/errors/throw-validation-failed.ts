import { BadRequestException } from "@nestjs/common";

import type { ValidationFieldError } from "./validation-errors.mapper";

export function throwValidationFailed(
  validationErrors: readonly ValidationFieldError[],
  message = "Request validation failed",
): never {
  throw new BadRequestException({
    error: {
      code: "VALIDATION_FAILED",
      message,
      retryability: "NO_RETRY",
      details: { validationErrors },
    },
  });
}
