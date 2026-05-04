import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiInternalServerErrorResponse,
  ApiTags
} from "@nestjs/swagger";
import { Role } from "../auth/roles.enum";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { InternalApiKeyGuard } from "../ops/internal-api-key.guard";
import { LoggerService } from "../../common/logger/logger.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { PaymentResponseDto } from "./dto/payment-response.dto";
import { PaymentWebhookDto } from "./dto/payment-webhook.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { PaymentsService } from "./payments.service";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";

@ApiTags("Payments")
@Controller("api/v2")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("payments/intent")
  @UseGuards(JwtAuthGuard, RolesGuard)
  /** Members (participants) create intents for registrations in their tenant; leaders/admins retain access. */
  @Roles(Role.LEADER, Role.ADMIN, Role.MEMBER)
  @ApiBearerAuth()
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Required idempotency key for create mutation."
  })
  @ApiOperation({ summary: "Create payment intent for registration" })
  @ApiBody({ type: CreatePaymentIntentDto })
  @ApiCreatedResponse({ type: PaymentResponseDto })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/payments/intent",
    statusCode: 201,
    required: true,
    tenantSource: "context"
  })
  async createPaymentIntent(
    @Body() payload: CreatePaymentIntentDto
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.createPaymentIntent(payload);
  }

  @Get("admin/payments")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Admin list of recent payments" })
  @ApiOkResponse({ type: PaymentResponseDto, isArray: true })
  async listPayments(): Promise<PaymentResponseDto[]> {
    return this.paymentsService.listPayments();
  }

  @Get("admin/payments/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Admin get payment by id" })
  @ApiOkResponse({ type: PaymentResponseDto })
  async getPayment(
    @Param("id", new ParseUUIDPipe()) id: string
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.getPaymentById(id);
  }

  @Post("admin/payments/:id/refund")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Required idempotency key for refund mutation."
  })
  @ApiOperation({ summary: "Admin refund payment and reconcile registration" })
  @ApiOkResponse({ type: PaymentResponseDto })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/admin/payments/:id/refund",
    statusCode: 200,
    required: true,
    tenantSource: "context"
  })
  async refundPayment(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: RefundPaymentDto
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.refundPayment(id, body.reason);
  }
}

@ApiTags("Payments")
@Controller("internal/payments")
@UseGuards(InternalApiKeyGuard)
export class PaymentsWebhookController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly loggerService: LoggerService,
    private readonly requestContextService: RequestContextService
  ) {}

  @Post("webhook")
  @HttpCode(200)
  @ApiSecurity("internalApiKey")
  @ApiHeader({
    name: "X-Internal-Api-Key",
    required: true,
    description: "Internal API key required for webhook ingestion."
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
