import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseGuards
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { SkipThrottle, Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { LoggerService } from "../../../common/logger/logger.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PaymentWebhookDto } from "../dto/payment-webhook.dto";
import { PaymentsService } from "../payments.service";
import { PaymentWebhookSignatureGuard } from "./payments-webhook-signature.guard";

@ApiTags("Payments")
/** Webhook uses only `payments-webhook` bucket; do not consume `public-registration` (shared IP limit). */
@SkipThrottle({ "public-registration": true })
@Controller("internal/payments")
@UseGuards(ThrottlerGuard, PaymentWebhookSignatureGuard)
export class PaymentsWebhookController {
  constructor(
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
    @Inject(LoggerService) private readonly loggerService: LoggerService,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService
  ) {}

  @Post("webhook")
  @HttpCode(200)
  @Throttle({
    "payments-webhook": { limit: 500, ttl: 60_000, blockDuration: 1 }
  })
  @ApiHeader({
    name: "X-Payments-Webhook-Timestamp",
    required: true,
    description: "Unix timestamp (seconds) used in HMAC; must be within ±5 minutes."
  })
  @ApiHeader({
    name: "X-Payments-Webhook-Signature",
    required: true,
    description: "Lowercase hex HMAC-SHA256 of `${timestamp}.${rawBody}` using PAYMENTS_WEBHOOK_SIGNING_SECRET."
  })
  @ApiOperation({
    summary:
      "Internal payment provider webhook (200 on processed/unknown payment; non-200 on binding or processing failure)"
  })
  @ApiBody({ type: PaymentWebhookDto })
  @ApiOkResponse({
    schema: {
      example: { ok: true }
    },
    description: "Returns 200 for processed/deduplicated/unknown payment events."
  })
  @ApiBadRequestResponse({
    description: "Tenant binding failed for webhook payload/payment scope."
  })
  @ApiInternalServerErrorResponse({
    description: "Webhook processing failed."
  })
  async webhook(@Body() payload: PaymentWebhookDto): Promise<{ ok: true }> {
    const requestId = this.safeRequestId();
    this.loggerService.info("webhook_received", {
      request_id: requestId,
      event_type: "payment.webhook",
      provider: "internal_provider",
      provider_event_id: payload.providerEventId ?? null,
      provider_payment_id: payload.providerPaymentId,
      tenant_id: payload.tenant_id,
      status: payload.status
    });
    try {
      const result = await this.paymentsService.processWebhook(payload);
      if (!result.processed) {
        this.loggerService.warn("webhook_unknown_payment", {
          request_id: result.requestId,
          event_type: "payment.webhook",
          provider: "internal_provider",
          provider_event_id: result.providerEventId,
          provider_payment_id: payload.providerPaymentId,
          tenant_id: payload.tenant_id,
          status: payload.status,
          error_message: "PAYMENT_NOT_FOUND"
        });
      } else if (result.deduplicated) {
        this.loggerService.info("webhook_deduplicated", {
          request_id: result.requestId,
          event_type: "payment.webhook",
          provider: result.provider ?? "internal_provider",
          provider_event_id: result.providerEventId,
          provider_payment_id: result.providerPaymentId,
          tenant_id: result.tenantId,
          status: result.status
        });
      } else {
        this.loggerService.info("webhook_processed", {
          request_id: result.requestId,
          event_type: "payment.webhook",
          provider: result.provider ?? "internal_provider",
          provider_event_id: result.providerEventId,
          provider_payment_id: result.providerPaymentId,
          tenant_id: result.tenantId,
          status: result.status
        });
      }
    } catch (error: unknown) {
      const asBadRequest = error instanceof BadRequestException ? error : null;
      const err = error instanceof Error ? error : new Error(String(error));
      if (asBadRequest) {
        this.loggerService.warn("webhook_binding_failed", {
          request_id: requestId,
          event_type: "payment.webhook",
          provider: "internal_provider",
          provider_event_id: payload.providerEventId ?? null,
          provider_payment_id: payload.providerPaymentId,
          tenant_id: payload.tenant_id,
          status: payload.status,
          error_message: err.message
        });
      } else {
        this.loggerService.error("webhook_failed", {
          request_id: requestId,
          event_type: "payment.webhook",
          provider: "internal_provider",
          provider_event_id: payload.providerEventId ?? null,
          provider_payment_id: payload.providerPaymentId,
          tenant_id: payload.tenant_id,
          status: payload.status,
          error_message: err.message,
          stack: err.stack ?? null
        });
      }
      throw error;
    }
    return { ok: true };
  }

  private safeRequestId(): string {
    try {
      return this.requestContextService.getRequestId();
    } catch {
      return "unknown";
    }
  }
}
