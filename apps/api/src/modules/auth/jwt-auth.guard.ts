import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const authorization = request.header("authorization");
    if (!authorization) {
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
