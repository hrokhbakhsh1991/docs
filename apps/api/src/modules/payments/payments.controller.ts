import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "../auth/roles.enum";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { InternalApiKeyGuard } from "../ops/internal-api-key.guard";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { PaymentResponseDto } from "./dto/payment-response.dto";
import { PaymentWebhookDto } from "./dto/payment-webhook.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("Payments")
@Controller("api/v2")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("payments/intent")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEADER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create payment intent for registration" })
  @ApiOkResponse({ type: PaymentResponseDto })
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
  @ApiOperation({ summary: "Admin refund payment and reconcile registration" })
  @ApiOkResponse({ type: PaymentResponseDto })
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
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("webhook")
  @HttpCode(200)
  @ApiOperation({ summary: "Internal payment provider webhook (idempotent)" })
  async webhook(@Body() payload: PaymentWebhookDto): Promise<{ ok: true }> {
    try {
      await this.paymentsService.processWebhook(payload);
    } catch {
      // Webhook endpoint must remain idempotent and always return 200.
    }
    return { ok: true };
  }
}
