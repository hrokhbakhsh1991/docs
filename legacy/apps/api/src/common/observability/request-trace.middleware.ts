import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";

/**
 * Emits one structured `REQUEST_TRACE` line per HTTP request (after response completes).
 * Runs after auth middleware so tenant/user/role/capabilities are populated when present.
 */
@Injectable()
export class RequestTraceMiddleware implements NestMiddleware {
  constructor(
    @Inject(LoggerService) private readonly loggerService: LoggerService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const started = Date.now();
    res.on("finish", () => {
      const ctx = this.requestContextService.tryGetStructuredLogContext();
      const caps = this.requestContextService.tryGetWorkspaceCapabilities();
      this.loggerService.info("REQUEST_TRACE", {
        ...(ctx ?? {}),
        endpoint: typeof req.path === "string" ? req.path : req.url,
        status_code: res.statusCode,
        duration_ms: Date.now() - started,
        capabilities: caps?.length ? caps.join(",") : undefined,
      });
    });
    next();
  }
}
