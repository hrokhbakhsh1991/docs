import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { Request } from "express";

/**
 * Ensures the `Authorization` header is present only; JWT verification occurs in middleware.
 */
@Injectable()
export class AuthorizationPresenceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const authorization = request.header("authorization");
    const internalApiKey = request.header("x-internal-api-key");
    if (!authorization && !internalApiKey) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_UNAUTHENTICATED",
          message: "Authentication required"
        }
      });
    }
    return true;
  }
}
