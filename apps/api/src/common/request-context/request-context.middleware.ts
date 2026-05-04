import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requestContextStorage } from "./request-context";

type RequestWithRequestId = Request & { requestId?: string };

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incomingRequestId = req.header("x-request-id");
    const requestId =
      incomingRequestId && incomingRequestId.trim() !== ""
        ? incomingRequestId
        : randomUUID();
    (req as RequestWithRequestId).requestId = requestId;
    res.setHeader("x-request-id", requestId);

    requestContextStorage.run(
      { requestId, path: req.path, method: req.method },
      () => {
        next();
      }
    );
  }
}
