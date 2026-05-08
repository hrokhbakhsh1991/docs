import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse
} from "@nestjs/swagger";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { CancelWaitlistItemDto } from "./dto/cancel-waitlist-item.dto";
import { ConvertWaitlistItemDto } from "./dto/convert-waitlist-item.dto";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { CreateRegistrationDto } from "./dto/create-registration.dto";
import { CreateWaitlistItemDto } from "./dto/create-waitlist-item.dto";
import {
  ErrorResponseDto,
  RegistrationResponseDto,
  WaitlistItemResponseDto
} from "./dto/get-registration.dto";
import { UpdateRegistrationPaymentDto } from "./dto/update-registration-payment.dto";
import { UpdateRegistrationStatusDto } from "./dto/update-registration-status.dto";
import { RegistrationsService } from "./registrations.service";
import { PaymentsService } from "../payments/payments.service";
import { CreatePaymentIntentDto } from "../payments/dto/create-payment-intent.dto";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { requestContextStorage } from "../../common/request-context/request-context";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { TenantBootstrapService } from "../tenant/tenant-bootstrap.service";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";

@ApiTags("Registrations")
@Controller("api/v2")
export class RegistrationsController {
  // DI-DIAGNOSTIC: Constructor-injected services observed as undefined in E2E runtime; inspect emitted decorator metadata and module container resolution.
  // TODO(FREEZE-BLOCKER): E2E failures show RegistrationsService/RequestContextService may be undefined at runtime; verify DI graph and provider resolution order in AppModule + RegistrationsModule bootstrap path.
  constructor(
    private readonly registrationsService: RegistrationsService,
    private readonly paymentsService: PaymentsService,
    private readonly idempotencyService: IdempotencyService,
    private readonly requestContextService: RequestContextService,
    private readonly tenantBootstrapService: TenantBootstrapService
  ) {}

  @Post("tours/:tourId/register")
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    "public-registration": { limit: 10, ttl: 60_000, blockDuration: 1 }
  })
  @ApiHeader({
    name: "idempotency-key",
    required: false,
    description: "Optional idempotency key for safe replay."
  })
  @ApiOperation({ summary: "Public registration endpoint (capacity-aware)" })
  @ApiCreatedResponse({
    schema: {
      type: "object",
      additionalProperties: true
    }
  })
  async publicRegister(
    @Param("tourId", new ParseUUIDPipe()) tourId: string,
    @Body() payload: CreateRegistrationDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ): Promise<Record<string, unknown>> {
    // Tenant bootstrap for public flow — resolves tenant before first RLS-bound repository query.
    const tenantScope = await this.tenantBootstrapService.resolveTenantFromTourId(tourId);
    if (!tenantScope) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }
    this.requestContextService.setTenantId(tenantScope);
    /** TypeORM idempotency / transaction callbacks can drop ALS; re-enter for downstream `RequestContextService` reads. */
    const requestContextSnapshot = requestContextStorage.getStore();

    const executePlacement = async () => {
      const result = await this.registrationsService.createPublicRegistrationOrWaitlist({
        ...payload,
        tourId,
        createPaymentIntent: async (manager, registrationId) =>
          this.paymentsService.createPaymentIntentWithManager(
            manager,
            ({
              registrationId,
              /** Placeholder intent; `CreatePaymentIntentDto` requires `@Min(1)`. */
              amount: 1,
              currency: "IRR",
              paymentProvider: "mock_provider",
              providerPaymentId: `mock-${registrationId}`
            } satisfies CreatePaymentIntentDto)
          )
      });
      if (result.type === "waitlist") {
        return {
          registration: null,
          paymentIntent: null,
          waitlistItemId: result.waitlistItem.id,
          waitlistPosition: result.queuePosition
        };
      }
      return {
        registration: result.registration,
        paymentIntent: result.paymentIntent,
        waitlistPosition: null
      };
    };

    const handler = async () =>
      requestContextSnapshot
        ? requestContextStorage.run(requestContextSnapshot, executePlacement)
        : executePlacement();

    if (!idempotencyKey) {
      return handler();
    }
    const requestHash = this.idempotencyService.createRequestHash({
      method: "POST",
      path: `/api/v2/tours/${tourId}/register`,
      body: payload
    });
    const result = await this.idempotencyService.executeWithIdempotency(
      {
        tenantId: tenantScope,
        key: idempotencyKey,
        endpoint: "/api/v2/tours/:tourId/register",
        requestHash,
        statusCode: 201
      },
      async () => handler()
    );
    return result.responseBody;
  }

  @Post("tours/:tourId/waitlist")
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    "public-registration": { limit: 10, ttl: 60_000, blockDuration: 1 }
  })
  @ApiHeader({
    name: "idempotency-key",
    required: false,
    description: "Optional idempotency key for safe replay."
  })
  @ApiOperation({ summary: "Public explicit waitlist endpoint" })
  @ApiCreatedResponse({
    schema: {
      type: "object",
      properties: {
        waitlistItemId: { type: "string" },
        queuePosition: { type: "number" }
      },
      required: ["waitlistItemId", "queuePosition"]
    }
  })
  async publicWaitlist(
    @Param("tourId", new ParseUUIDPipe()) tourId: string,
    @Body() payload: CreateWaitlistItemDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ): Promise<{ waitlistItemId: string; queuePosition: number }> {
    // Tenant bootstrap for public flow — resolves tenant before first RLS-bound repository query.
    const tenantScope = await this.tenantBootstrapService.resolveTenantFromTourId(tourId);
    if (!tenantScope) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }
    this.requestContextService.setTenantId(tenantScope);
    const requestContextSnapshot = requestContextStorage.getStore();
    const executeWaitlistOnly = async () => {
      const result = await this.registrationsService.createPublicRegistrationOrWaitlist({
        ...payload,
        tourId
      });
      if (result.type === "waitlist") {
        return {
          waitlistItemId: result.waitlistItem.id,
          queuePosition: result.queuePosition
        };
      }
      throw new ConflictException({
        error: {
          code: "CAPACITY_AVAILABLE",
          message: "Capacity available; use /register endpoint"
        }
      });
    };
    const handler = async () =>
      requestContextSnapshot
        ? requestContextStorage.run(requestContextSnapshot, executeWaitlistOnly)
        : executeWaitlistOnly();
    if (!idempotencyKey) {
      return handler();
    }
    const requestHash = this.idempotencyService.createRequestHash({
      method: "POST",
      path: `/api/v2/tours/${tourId}/waitlist`,
      body: payload
    });
    const result = await this.idempotencyService.executeWithIdempotency(
      {
        tenantId: tenantScope,
        key: idempotencyKey,
        endpoint: "/api/v2/tours/:tourId/waitlist",
        requestHash,
        statusCode: 201
      },
      async () => handler()
    );
    return result.responseBody as { waitlistItemId: string; queuePosition: number };
  }

  @Post("registrations")
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required idempotency key for create mutation."
  })
  @Roles(Role.PARTICIPANT, Role.OWNER, Role.ADMIN)
  @ApiOperation({
    summary: "Create registration (Participant or Leader)"
  })
  @ApiCreatedResponse({ type: RegistrationResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: "Validation errors (e.g. VALIDATION_FAILED, VALIDATION_ENUM_INVALID)"
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: "Authentication errors (AUTH_*)"
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: "Tenant and authorization errors (TENANT_*, AUTH_FORBIDDEN_ROLE)"
  })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/registrations",
    statusCode: 201,
    required: true,
    tenantSource: "context"
  })
  async createRegistration(
    @Body() payload: CreateRegistrationDto
  ): Promise<RegistrationResponseDto> {
    return this.registrationsService.createRegistration(payload);
  }

  @Post("bookings")
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required idempotency key for create mutation."
  })
  @Roles(Role.PARTICIPANT, Role.OWNER)
  @ApiOperation({
    summary: "Create booking (register for tour)",
    description:
      "Authenticated shortcut: send only tourId; server fills participant fields from the signed-in user."
  })
  @ApiCreatedResponse({ type: RegistrationResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: "Validation errors (e.g. VALIDATION_FAILED, VALIDATION_REQUIRED_FIELD_MISSING)"
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: "Authentication errors (AUTH_*)"
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: "Tenant and authorization errors (TENANT_*, AUTH_FORBIDDEN_ROLE)"
  })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/bookings",
    statusCode: 201,
    required: true,
    tenantSource: "context"
  })
  async createBooking(@Body() payload: CreateBookingDto): Promise<RegistrationResponseDto> {
    return this.registrationsService.createBooking(payload.tourId);
  }

  @Get("bookings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.PARTICIPANT, Role.OWNER)
  @ApiOperation({ summary: "List current user bookings" })
  @ApiOkResponse({ type: RegistrationResponseDto, isArray: true })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: "Authentication errors (AUTH_*)"
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: "Tenant and authorization errors (TENANT_*, AUTH_FORBIDDEN_ROLE)"
  })
  async listBookings(): Promise<RegistrationResponseDto[]> {
    return this.registrationsService.listBookings();
  }

  @Get("registrations/:registrationId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.PARTICIPANT, Role.OWNER, Role.ADMIN)
  @ApiOperation({
    summary: "Get registration by id (Participant or Leader)"
  })
  @ApiOkResponse({ type: RegistrationResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: "Registration not found in tenant scope (RESOURCE_NOT_FOUND)"
  })
  async getRegistrationById(
    @Param("registrationId", new ParseUUIDPipe()) registrationId: string
  ): Promise<RegistrationResponseDto> {
    return this.registrationsService.getRegistrationById(registrationId);
  }

  @Patch("registrations/:registrationId/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required idempotency key for status mutation."
  })
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: "Update registration status (Leader only)"
  })
  @ApiOkResponse({ type: RegistrationResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/registrations/:registrationId/status",
    statusCode: 200,
    required: true,
    tenantSource: "context"
  })
  async updateRegistrationStatus(
    @Param("registrationId", new ParseUUIDPipe()) registrationId: string,
    @Body() payload: UpdateRegistrationStatusDto
  ): Promise<RegistrationResponseDto> {
    return this.registrationsService.updateRegistrationStatus(registrationId, payload);
  }

  @Patch("registrations/:registrationId/payment")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required idempotency key for payment mutation."
  })
  @Roles(Role.OWNER)
  @ApiOperation({
    summary: "Update registration payment status (Leader only)"
  })
  @ApiOkResponse({ type: RegistrationResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async updateRegistrationPayment(
    @Param("registrationId", new ParseUUIDPipe()) registrationId: string,
    @Body() payload: UpdateRegistrationPaymentDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ): Promise<RegistrationResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_REQUIRED_FIELD_MISSING",
          message: "Idempotency-Key header is required"
        }
      });
    }
    const requestHash = this.idempotencyService.createRequestHash({
      method: "PATCH",
      path: `/api/v2/registrations/${registrationId}/payment`,
      body: payload
    });
    const result = await this.idempotencyService.executeWithIdempotency(
      {
        tenantId: this.requireTrustedTenantId(),
        key: idempotencyKey,
        endpoint: "/api/v2/registrations/:registrationId/payment",
        requestHash,
        statusCode: 200
      },
      async () =>
        this.registrationsService.updateRegistrationPayment(registrationId, payload)
    );
    return result.responseBody as RegistrationResponseDto;
  }

  @Post("waitlist-items")
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required idempotency key for create mutation."
  })
  @Roles(Role.PARTICIPANT, Role.OWNER)
  @ApiOperation({
    summary: "Create waitlist item (Participant or Leader)"
  })
  @ApiCreatedResponse({ type: WaitlistItemResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/waitlist-items",
    statusCode: 201,
    required: true,
    tenantSource: "context"
  })
  async createWaitlistItem(
    @Body() payload: CreateWaitlistItemDto
  ): Promise<WaitlistItemResponseDto> {
    return this.registrationsService.createWaitlistItem(payload);
  }

  @Post("waitlist-items/:waitlistItemId/convert")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required idempotency key for convert mutation."
  })
  @ApiOperation({
    summary: "Convert waitlist item (Leader only)"
  })
  @ApiOkResponse({ type: WaitlistItemResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async convertWaitlistItem(
    @Param("waitlistItemId", new ParseUUIDPipe()) waitlistItemId: string,
    @Body() payload: ConvertWaitlistItemDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ): Promise<WaitlistItemResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_REQUIRED_FIELD_MISSING",
          message: "Idempotency-Key header is required"
        }
      });
    }
    const requestHash = this.idempotencyService.createRequestHash({
      method: "POST",
      path: `/api/v2/waitlist-items/${waitlistItemId}/convert`,
      body: payload
    });
    const result = await this.idempotencyService.executeWithIdempotency(
      {
        tenantId: this.requireTrustedTenantId(),
        key: idempotencyKey,
        endpoint: "/api/v2/waitlist-items/:waitlistItemId/convert",
        requestHash,
        statusCode: 200
      },
      async () => this.registrationsService.convertWaitlistItem(waitlistItemId, payload)
    );
    return result.responseBody as WaitlistItemResponseDto;
  }

  @Patch("waitlist-items/:waitlistItemId/cancel")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PARTICIPANT, Role.OWNER)
  @ApiBearerAuth()
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required idempotency key for cancel mutation."
  })
  @ApiOperation({
    summary: "Cancel waitlist item (Participant or Leader)"
  })
  @ApiOkResponse({ type: WaitlistItemResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async cancelWaitlistItem(
    @Param("waitlistItemId", new ParseUUIDPipe()) waitlistItemId: string,
    @Body() payload: CancelWaitlistItemDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ): Promise<WaitlistItemResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_REQUIRED_FIELD_MISSING",
          message: "Idempotency-Key header is required"
        }
      });
    }
    const requestHash = this.idempotencyService.createRequestHash({
      method: "PATCH",
      path: `/api/v2/waitlist-items/${waitlistItemId}/cancel`,
      body: payload
    });
    const result = await this.idempotencyService.executeWithIdempotency(
      {
        tenantId: this.requireTrustedTenantId(),
        key: idempotencyKey,
        endpoint: "/api/v2/waitlist-items/:waitlistItemId/cancel",
        requestHash,
        statusCode: 200
      },
      async () => this.registrationsService.cancelWaitlistItem(waitlistItemId, payload)
    );
    return result.responseBody as WaitlistItemResponseDto;
  }

  private requireTrustedTenantId(): string {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new BadRequestException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required for idempotent operation"
        }
      });
    }
    return tenantId;
  }
}
