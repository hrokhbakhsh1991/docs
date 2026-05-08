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
        ? incomingRequestId
        : randomUUID();
    (req as RequestWithRequestId).requestId = requestId;
    res.setHeader("x-request-id", requestId);

    const trustedProxyCidrs =
      this.configService && typeof this.configService.getTrustedProxyCidrs === "function"
        ? this.configService.getTrustedProxyCidrs()
        : [];
    requestContextStorage.run(
      {
        requestId,
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
