import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable
} from "@nestjs/common";
import type { Request } from "express";

type RateBucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, RateBucket>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.resolveIp(request);
    const now = Date.now();
    const current = this.counters.get(ip);

    if (!current || current.resetAt <= now) {
      this.counters.set(ip, {
        count: 1,
        resetAt: now + WINDOW_MS
      });
      return true;
    }

    current.count += 1;
    if (current.count > MAX_REQUESTS_PER_WINDOW) {
      throw new HttpException("Too Many Requests", 429);
    }

    return true;
  }

  private resolveIp(request: Request): string {
    const forwarded = request.headers["x-forwarded-for"];
    const firstForwardedIp = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(",")[0];
    const normalizedForwarded = firstForwardedIp?.trim();
    if (normalizedForwarded) {
      return normalizedForwarded;
    }
    return request.ip ?? "unknown";
  }
}
