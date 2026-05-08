import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { firstValueFrom, from, Observable } from "rxjs";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { IdempotencyService } from "./idempotency.service";
import { IDEMPOTENCY_POLICY_KEY, type IdempotencyPolicy } from "./idempotent.decorator";

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const policy = this.reflector.getAllAndOverride<IdempotencyPolicy>(
      IDEMPOTENCY_POLICY_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (!policy) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      body?: Record<string, unknown>;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const idempotencyKeyRaw = request.headers["idempotency-key"];
    const idempotencyKey = Array.isArray(idempotencyKeyRaw)
      ? idempotencyKeyRaw[0]
      : idempotencyKeyRaw;

    if (!idempotencyKey) {
      if (policy.required) {
        throw new BadRequestException({
          error: {
            code: "VALIDATION_REQUIRED_FIELD_MISSING",
            message: "Idempotency-Key header is required"
          }
        });
      }
      return next.handle();
    }

    const tenantId = this.resolveTenantId(policy, request.body);
    const requestHash = this.idempotencyService.createRequestHash({
      method: request.method,
      path: request.originalUrl ?? policy.endpoint,
      body: request.body ?? null
    });

    return from(
      this.idempotencyService
        .executeWithIdempotency(
          {
            tenantId,
            key: idempotencyKey,
            endpoint: policy.endpoint,
            requestHash,
            statusCode: policy.statusCode
          },
          async () => (await firstValueFrom(next.handle())) as Record<string, unknown>
        )
        .then((result) => result.responseBody)
    );
  }

  private resolveTenantId(policy: IdempotencyPolicy, body?: Record<string, unknown>): string {
    if (policy.tenantSource === "context") {
      const trustedTenantId = this.requestContextService.resolveEffectiveTenantId();
      if (!trustedTenantId) {
        throw new BadRequestException({
          error: {
            code: "TENANT_CONTEXT_MISSING",
            message: "Trusted tenant context required for idempotent operation"
          }
        });
      }
      return trustedTenantId;
    }

    const field = policy.tenantBodyField ?? "tenantId";
    const tenantId = body?.[field];
    if (typeof tenantId === "string" && tenantId.length > 0) {
      return tenantId;
    }
    throw new BadRequestException({
      error: {
        code: "VALIDATION_REQUIRED_FIELD_MISSING",
        message: `${field} is required for idempotent operation`
      }
    });
  }
}
