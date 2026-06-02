import { ConflictException } from "@nestjs/common";

export class CapacityExceededException extends ConflictException {
  constructor(message = "Tour capacity is completely full.") {
    super({
      error: {
        code: "CAPACITY_FULL",
        message,
      },
    });
  }
}
