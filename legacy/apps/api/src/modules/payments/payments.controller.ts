import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { UserRole } from "../../common/auth/user-role.enum";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { RequireCapability } from "../../common/casl/require-capability.decorator";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { PaymentResponseDto } from "./dto/payment-response.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { PaymentsService } from "./payments.service";
import { IdempotencyInterceptor } from "../idempotency/repositories/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";

@ApiTags("Payments")
@Controller("api/v2")
@RequireCapability("module.finance")
export class PaymentsController {
  constructor(
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService
  ) {}

  @Post("payments/intent")
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  /** Members (participants) create intents for registrations in their tenant; leaders/admins retain access. */
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Member, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "Payment"))
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
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @Roles(UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Payment"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "Admin list of recent payments" })
  @ApiOkResponse({ type: PaymentResponseDto, isArray: true })
  async listPayments(): Promise<PaymentResponseDto[]> {
    return this.paymentsService.listPayments();
  }

  @Get("admin/payments/:id")
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @Roles(UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Payment"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "Admin get payment by id" })
  @ApiOkResponse({ type: PaymentResponseDto })
  async getPayment(
    @Param("id", new ParseUUIDPipe()) id: string
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.getPaymentById(id);
  }

  @Post("admin/payments/:id/refund")
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @Roles(UserRole.Admin)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Payment"))
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
    @Body() body: RefundPaymentDto,
    @Headers("idempotency-key") idempotencyKey: string
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.refundPayment(id, body.reason, idempotencyKey);
  }
}
