import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { context as otelContext, trace } from "@opentelemetry/api";
import { ATTR_HTTP_ROUTE } from "@opentelemetry/semantic-conventions";
import type { Request } from "express";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";

type ExpressRouteRequest = Request & {
  route?: { path?: string };
};

/**
 * Enriches the active HTTP span (OpenTelemetry) with route + tenant context; emits one structured
 * debug log per successful response (errors are logged in {@link GlobalExceptionFilter}).
 */
@Injectable()
export class HttpObservabilityInterceptor implements NestInterceptor {
  constructor(
    @Inject(LoggerService) private readonly loggerService: LoggerService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService
  ) {}

  intercept(nestCtx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = Date.now();
    const req = nestCtx.switchToHttp().getRequest<ExpressRouteRequest>();

    const span = trace.getSpan(otelContext.active());
    const routeTemplate =
      typeof req.route?.path === "string"
        ? `${req.baseUrl ?? ""}${req.route.path}`.replace(/\/{2,}/g, "/") ||
          (typeof req.path === "string" ? req.path : "")
        : typeof req.path === "string"
          ? req.path
          : "";

    if (span && routeTemplate !== "") {
      span.setAttribute(ATTR_HTTP_ROUTE, routeTemplate);
      span.setAttribute("route", routeTemplate);
    }

    const logCtx = this.requestContextService.tryGetStructuredLogContext();
    if (span && logCtx) {
      if (logCtx.request_id) {
        span.setAttribute("request_id", logCtx.request_id);
      }
      if (logCtx.route && logCtx.route !== "") {
        span.setAttribute("route", logCtx.route);
      }
      if (logCtx.tenant_id) {
        span.setAttribute("tenant_id", logCtx.tenant_id);
      }
      if (logCtx.user_id) {
        span.setAttribute("user_id", logCtx.user_id);
      }
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const res = nestCtx.switchToHttp().getResponse<{ statusCode?: number }>();
          this.loggerService.debug("http_request_completed", {
            status_code: res.statusCode ?? 0,
            duration_ms: Date.now() - started,
            route: routeTemplate || (typeof req.path === "string" ? req.path : undefined),
            method: typeof req.method === "string" ? req.method : undefined
          });
        }
      })
    );
  }
}
