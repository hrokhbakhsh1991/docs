import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { resolveThrottleClientIp } from "../throttling/public-registration-throttle";
import { ConfigService } from "../../config/config.service";
import { requestContextStorage } from "./request-context";

type RequestWithRequestId = Request & { requestId?: string };

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incomingRequestId = req.header("x-request-id");
    const requestId =
      incomingRequestId && incomingRequestId.trim() !== ""
        ? incomingRequestId.trim()
        : randomUUID();
    const incomingCorrelationId = req.header("x-correlation-id");
    const correlationId =
      incomingCorrelationId && incomingCorrelationId.trim() !== ""
        ? incomingCorrelationId.trim()
        : requestId;
    
    const incomingTraceparent = req.header("traceparent");
    const traceparent =
      incomingTraceparent && incomingTraceparent.trim() !== ""
        ? incomingTraceparent.trim()
        : `00-${randomUUID().replace(/-/g, "")}-${randomUUID().replace(/-/g, "").substring(0, 16)}-01`;

    (req as RequestWithRequestId).requestId = requestId;
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-correlation-id", correlationId);
    res.setHeader("traceparent", traceparent);

    const trustedProxyCidrs =
      this.configService && typeof this.configService.getTrustedProxyCidrs === "function"
        ? this.configService.getTrustedProxyCidrs()
        : [];
    requestContextStorage.run(
      {
        requestId,
        correlationId,
        traceparent,
        path: req.path,
        method: req.method,
        clientIp: resolveThrottleClientIp(req as unknown as Record<string, unknown>, {
          trustedProxyCidrs
        })
      },
      () => {
        next();
      }
    );
  }
}
