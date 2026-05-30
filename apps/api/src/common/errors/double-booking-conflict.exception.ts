import { ConflictException } from "@nestjs/common";

export class DoubleBookingConflictException extends ConflictException {
  constructor(message = "Tour capacity was exhausted during confirmation.") {
    super({
      error: {
        code: "DOUBLE_BOOKING_CONFLICT",
        message,
      },
    });
  }
}
