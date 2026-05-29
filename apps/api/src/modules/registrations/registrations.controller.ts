import { randomUUID } from "node:crypto";
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
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  type ExecutionContext
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { RequireCapability } from "../../common/casl/require-capability.decorator";
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
import type { RegistrationPaymentIntentSnapshot } from "./domain/registration-payment-intent.types";
import { UpdateRegistrationPaymentDto } from "./dto/update-registration-payment.dto";
import { UpdateRegistrationStatusDto } from "./dto/update-registration-status.dto";
import { RegistrationsService } from "./registrations.service";
import { RegistrationPlacementOrchestrator } from "./application/registration-placement.orchestrator";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { runWithIdempotentEntityManager } from "../idempotency/idempotent-transaction.context";
import { requestContextStorage } from "../../common/request-context/request-context";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { TenantBootstrapService } from "../tenant/tenant-bootstrap.service";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";
import { assertPublicRegistrationIdempotencyKey } from "../idempotency/http-idempotency-key";

/** Route-level limits stay strict in production; E2E raises `NODE_ENV` to `test` before requests so Redis buckets match `AppModule` throttler config. */
const publicRegistrationThrottleLimit =
  (prodLimit: number) =>
  (_context: ExecutionContext): number =>
    process.env.NODE_ENV === "test" ? 8000 : prodLimit;

@ApiTags("Registrations")
@Controller("api/v2")
export class RegistrationsController {
  /** Explicit `@Inject` keeps E2E (tsx) DI stable when `emitDecoratorMetadata` paramtypes are absent. */
  constructor(
    @Inject(RegistrationsService) private readonly registrationsService: RegistrationsService,
    @Inject(RegistrationPlacementOrchestrator)
    private readonly registrationPlacementOrchestrator: RegistrationPlacementOrchestrator,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(TenantBootstrapService) private readonly tenantBootstrapService: TenantBootstrapService
  ) {}

  private async bootstrapPublicTourTenant(tourId: string): Promise<string> {
    const bootstrap = await this.tenantBootstrapService.resolvePublicTourBootstrapContext(tourId);
    if (!bootstrap) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }
    this.requestContextService.setTenantId(bootstrap.tenantId);
    this.requestContextService.setTenantEnabledModules(bootstrap.enabledModules);
    return bootstrap.tenantId;
  }

  @Get("tours/:tourId/registration-idempotency-key")
  @UseGuards(ThrottlerGuard)
  @Throttle({
    "public-registration": {
      limit: publicRegistrationThrottleLimit(30),
      ttl: 60_000,
      blockDuration: 1
    }
  })
  @ApiOperation({
    summary: "Mint a suggested Idempotency-Key for public registration",
    description:
      "Returns a UUID suitable as `Idempotency-Key` for `POST …/register` or `POST …/waitlist`. Validates that the tour exists (tenant bootstrap). Does not reserve server-side state — the client must send the key on the mutation."
  })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: { idempotencyKey: { type: "string", format: "uuid" } },
      required: ["idempotencyKey"]
    }
  })
  @ApiNotFoundResponse({ description: "Tour not found" })
  async mintPublicRegistrationIdempotencyKey(
    @Param("tourId", new ParseUUIDPipe()) tourId: string
  ): Promise<{ idempotencyKey: string }> {
    await this.bootstrapPublicTourTenant(tourId);
    return { idempotencyKey: randomUUID() };
  }

  @Post("tours/:tourId/register")
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    "public-registration": {
      limit: publicRegistrationThrottleLimit(10),
      ttl: 60_000,
      blockDuration: 1
    }
  })
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description:
      "Required for all public registrations. Reuse the same key only when retrying the identical request body; otherwise mint a fresh key (UUID) or call GET …/registration-idempotency-key."
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
    @Headers("idempotency-key") idempotencyKeyHeader?: string
  ): Promise<Record<string, unknown>> {
    await this.bootstrapPublicTourTenant(tourId);
    const idempotencyKey = assertPublicRegistrationIdempotencyKey(idempotencyKeyHeader);
    /** TypeORM idempotency / transaction callbacks can drop ALS; re-enter for downstream `RequestContextService` reads. */
    const requestContextSnapshot = requestContextStorage.getStore();

    const executePlacement = async () => {
      return this.registrationPlacementOrchestrator.publicRegister({
        tourId,
        payload
      });
    };

    const requestHash = this.idempotencyService.createRequestHash({
      method: "POST",
      path: `/api/v2/tours/${tourId}/register`,
      body: payload
    });
    const result = await this.idempotencyService.executeWithIdempotency(
      {
        key: idempotencyKey,
        endpoint: "/api/v2/tours/:tourId/register",
        requestHash,
        statusCode: 201
      },
      async (manager) =>
        runWithIdempotentEntityManager(manager, () =>
          requestContextSnapshot
            ? requestContextStorage.run(requestContextSnapshot, executePlacement)
            : executePlacement(),
          { idempotencyKey }
        )
    );
    return result.responseBody;
  }

  @Post("tours/:tourId/waitlist")
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    "public-registration": {
      limit: publicRegistrationThrottleLimit(10),
      ttl: 60_000,
      blockDuration: 1
    }
  })
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required for public waitlist placement (replay-safe)."
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
    @Headers("idempotency-key") idempotencyKeyHeader?: string
  ): Promise<{ waitlistItemId: string; queuePosition: number }> {
    await this.bootstrapPublicTourTenant(tourId);
    const idempotencyKey = assertPublicRegistrationIdempotencyKey(idempotencyKeyHeader);
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
    const requestHash = this.idempotencyService.createRequestHash({
      method: "POST",
      path: `/api/v2/tours/${tourId}/waitlist`,
      body: payload
    });
    const result = await this.idempotencyService.executeWithIdempotency(
      {
        key: idempotencyKey,
        endpoint: "/api/v2/tours/:tourId/waitlist",
        requestHash,
        statusCode: 201
      },
      async (manager) =>
        runWithIdempotentEntityManager(manager, () =>
          requestContextSnapshot
            ? requestContextStorage.run(requestContextSnapshot, executeWaitlistOnly)
            : executeWaitlistOnly(),
          { idempotencyKey }
        )
    );
    return result.responseBody as { waitlistItemId: string; queuePosition: number };
  }

  @Post("registrations")
  @HttpCode(201)
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required idempotency key for create mutation."
  })
  @Roles(UserRole.Member, UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "Registration"))
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
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required idempotency key for create mutation."
  })
  @Roles(UserRole.Member, UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "Registration"))
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
  async createBooking(@Body() payload: CreateBookingDto): Promise<{
    registration: RegistrationResponseDto;
    paymentIntent: RegistrationPaymentIntentSnapshot | null;
  }> {
    return this.registrationPlacementOrchestrator.createAuthenticatedBooking(payload.tourId);
  }

  @Get("bookings")
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.Member, UserRole.Owner, UserRole.Admin, UserRole.Leader, UserRole.Viewer)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Registration"))
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
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.Member, UserRole.Owner, UserRole.Admin, UserRole.Leader, UserRole.Viewer)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Registration"))
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
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required idempotency key for status mutation."
  })
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Registration"))
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
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @RequireCapability("module.finance")
  @ApiBearerAuth()
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Required idempotency key for booking payment attach / mutation (replay-safe)."
  })
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Registration"))
  @ApiOperation({
    summary: "Update registration payment status (Leader only)"
  })
  @ApiOkResponse({ type: RegistrationResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/registrations/:registrationId/payment",
    statusCode: 200,
    required: true,
    tenantSource: "context"
  })
  async updateRegistrationPayment(
    @Param("registrationId", new ParseUUIDPipe()) registrationId: string,
    @Body() payload: UpdateRegistrationPaymentDto,
    @Headers("idempotency-key") idempotencyKey: string
  ): Promise<RegistrationResponseDto> {
    return this.registrationsService.updateRegistrationPayment(
      registrationId,
      payload,
      idempotencyKey
    );
  }

  @Post("waitlist-items")
  @HttpCode(201)
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: "idempotency-key",
    required: true,
    description: "Required idempotency key for create mutation."
  })
  @Roles(UserRole.Member, UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "Registration"))
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
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Registration"))
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
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @Roles(UserRole.Member, UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Update, "Registration"))
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
        key: idempotencyKey,
        endpoint: "/api/v2/waitlist-items/:waitlistItemId/cancel",
        requestHash,
        statusCode: 200
      },
      async () => this.registrationsService.cancelWaitlistItem(waitlistItemId, payload)
    );
    return result.responseBody as WaitlistItemResponseDto;
  }
}
