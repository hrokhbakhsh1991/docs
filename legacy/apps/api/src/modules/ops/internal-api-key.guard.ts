import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { ConfigService } from "../../config/config.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { UserRole } from "../../common/auth/user-role.enum";

function timingSafeStringEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.getInternalApiKey();
    if (!expected || expected.trim() === "") {
      return true; // Not configured, delegate to other guards
    }

    const req = context.switchToHttp().getRequest<Request>();
    const received = req.header("x-internal-api-key") ?? "";

    if (received === "") {
      return true; // No key provided, delegate to other guards
    }

    if (!timingSafeStringEqual(expected, received)) {
      throw new UnauthorizedException({
        error: {
          code: "OPS_UNAUTHORIZED",
          message: "Invalid internal API key"
        }
      });
    }

    // Populate context for bypass (CASL + RolesGuard compatibility)
    this.requestContext.setUserId("00000000-0000-0000-0000-000000000000");
    this.requestContext.setRole(UserRole.Admin);
    this.requestContext.setWorkspaceAbilityContext("ACTIVE", [], ["*"]);

    return true;
  }
}
