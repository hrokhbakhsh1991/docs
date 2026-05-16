import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { ConfigService } from "../../config/config.service";

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
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.getInternalApiKey();
    if (!expected || expected.trim() === "") {
      throw new ForbiddenException({
        error: {
          code: "OPS_INTERNAL_KEY_NOT_CONFIGURED",
          message: "Internal ops endpoints require INTERNAL_API_KEY"
        }
      });
    }

    const req = context.switchToHttp().getRequest<Request>();
    const received = req.header("x-internal-api-key") ?? "";

    if (!timingSafeStringEqual(expected, received)) {
      throw new UnauthorizedException({
        error: {
          code: "OPS_UNAUTHORIZED",
          message: "Invalid internal API key"
        }
      });
    }

    return true;
  }
}
