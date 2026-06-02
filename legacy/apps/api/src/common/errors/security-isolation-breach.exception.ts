import { ForbiddenException } from "@nestjs/common";

export class SecurityIsolationBreachException extends ForbiddenException {
  constructor(message = "Cross-tenant cache access blocked.") {
    super({
      error: {
        code: "SECURITY_ISOLATION_BREACH",
        message,
      },
    });
  }
}
