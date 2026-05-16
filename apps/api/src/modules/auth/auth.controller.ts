import {
  ArgumentMetadata,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  ValidationPipe
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { LoggerService } from "../../common/logger/logger.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuthService } from "./auth.service";
import { AuthAbilityContextService } from "./auth-ability-context.service";
import { WorkspaceService } from "./workspace.service";
import { MembershipAbilityContextDto } from "./dto/membership-ability-context.dto";
import { LinkTelegramDto } from "./dto/link-telegram.dto";
import { AuthorizationPresenceGuard } from "./authorization-presence.guard";
import { Roles } from "./roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "./roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { TelegramSessionDto } from "./dto/telegram-session.dto";
import { PhoneSessionDto } from "./dto/phone-session.dto";
import { WorkspaceSessionDto } from "./dto/workspace-session.dto";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { PhonePreflightDto } from "./dto/phone-preflight.dto";
import { OtpRequestDto } from "./dto/otp-request.dto";
import { CompleteRegistrationDto } from "./dto/complete-registration.dto";
import {
  LinkTelegramResponseDto,
  TelegramSessionResponseDto,
  WebSessionResponseDto
} from "./dto/auth-session-response.dto";
import { AuthWorkspaceItemDto } from "./dto/auth-workspace-item.dto";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";
import type { Request } from "express";

/** Matches bootstrap global ValidationPipe; used for auth routes that also need `@Req()` (tsx E2E can break `@Body()` + `@Req()` parameter binding). */
const authInboundBodyPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true
});

@ApiTags("Auth")
@Controller("api/v2/auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(WorkspaceService) private readonly workspaceService: WorkspaceService,
    @Inject(AuthAbilityContextService)
    private readonly authAbilityContextService: AuthAbilityContextService,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(LoggerService) private readonly loggerService: LoggerService
  ) {}

  @Get("membership-ability-context")
  @ApiBearerAuth()
  @UseGuards(AuthorizationPresenceGuard)
  @ApiOperation({
    summary: "Membership labels and capability grants for CASL (active tenant)",
    description:
      "Reads ALS populated by AuthMiddleware from `user_tenants.labels`. Used by the web app to mirror API capability hydration.",
  })
  @ApiOkResponse({ type: MembershipAbilityContextDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  getMembershipAbilityContext(): MembershipAbilityContextDto {
    return this.authAbilityContextService.getMembershipAbilityContext();
  }

  @Post("web/session/otp")
  @HttpCode(200)
  @ApiOperation({
    summary: "Create web session token using phone OTP",
    description:
      "Tenant is resolved only from the HTTP `Host` (and `x-forwarded-host` when trusted): `{slug}.{TENANT_ROOT_DOMAIN}`. This endpoint is introduced for parallel phone+OTP auth migration."
  })
  @ApiBody({ type: PhoneSessionDto })
  @ApiOkResponse({
    description: "Authenticated web session created",
    type: WebSessionResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  @ApiNotFoundResponse({ description: "TENANT_HOST_UNKNOWN — slug has no matching tenant row" })
  @ApiForbiddenResponse({
    description: "TENANT_CONTEXT_MISSING, TENANT_SCOPE_FORBIDDEN (no membership), or invalid credentials"
  })
  async webSessionOtp(@Req() req: Request): Promise<{
    session_token: string;
    user_id: string;
    tenant_id: string;
    entry_mode: "web";
    requires_registration?: boolean;
    onboarding_token?: string;
  }> {
    try {
      const meta: ArgumentMetadata = { type: "body", metatype: PhoneSessionDto };
      const dto = (await authInboundBodyPipe.transform(req.body, meta)) as PhoneSessionDto;
      return await this.authService.createWebSessionOtp(dto);
    } catch (error: unknown) {
      this.loggerService.error("auth_web_otp_controller_error", {
        error_name: error instanceof Error ? error.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  @Get("workspace-host")
  @HttpCode(200)
  @ApiOperation({
    summary: "Lightweight workspace host probe",
    description:
      "Resolves tenant from HTTP Host only (no request body). Returns tenant metadata when the slug maps to a tenant row; 404 TENANT_HOST_UNKNOWN otherwise. Used by the web middleware lookup cache.",
  })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        tenant_id: { type: "string" },
        slug: { type: "string" }
      }
    }
  })
  @ApiNotFoundResponse({ description: "TENANT_HOST_UNKNOWN" })
  probeWorkspaceHost(@Req() req: Request): { tenant_id: string; slug: string } {
    const tenant = req.tenant;
    if (!tenant?.id) {
      /* Reaching here without req.tenant should be impossible if resolution middleware is active */
      throw new UnauthorizedException("TENANT_CONTEXT_MISSING");
    }
    const slug = tenant.subdomain?.trim();
    if (!slug) {
      throw new NotFoundException({
        error: { code: "TENANT_HOST_UNKNOWN", message: "No workspace matches this host" },
      });
    }
    return {
      tenant_id: tenant.id,
      slug,
    };
  }

  @Post("web/phone/preflight")
  @HttpCode(200)
  @ApiOperation({ summary: "Classify phone intent for auth onboarding flow" })
  @ApiBody({ type: PhonePreflightDto })
  async preflightPhone(
    @Body() dto: PhonePreflightDto
  ): Promise<{ mode: "existing_user" | "new_user"; invite_pending: boolean; phone: string }> {
    return this.authService.preflightPhone(dto);
  }

  @Post("web/otp/request")
  @HttpCode(200)
  @ApiOperation({ summary: "Request OTP for phone auth flow" })
  @ApiBody({ type: OtpRequestDto })
  async requestOtp(
    @Body() dto: OtpRequestDto
  ): Promise<{ otp_requested: true; delivery: "dev_static"; challenge_id: string }> {
    return this.authService.requestPhoneOtp(dto.phone);
  }

  @Post("web/registration/complete")
  @HttpCode(200)
  @ApiOperation({ summary: "Complete minimal registration after phone OTP verification" })
  @ApiBody({ type: CompleteRegistrationDto })
  async completeRegistration(@Body() dto: CompleteRegistrationDto): Promise<WebSessionResponseDto> {
    return this.authService.completeRegistration(dto);
  }

  @Post("telegram/session")
  @HttpCode(200)
  @ApiOperation({
    summary: "Create Telegram session token",
    description:
      "Same Host-based tenant resolution as web login. Telegram proof is in `telegram_init_payload`; tenant scope comes only from `request.tenant`."
  })
  @ApiBody({ type: TelegramSessionDto })
  @ApiOkResponse({
    description: "Authenticated Telegram session created",
    type: TelegramSessionResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Invalid Telegram init payload" })
  @ApiNotFoundResponse({ description: "TENANT_HOST_UNKNOWN" })
  @ApiForbiddenResponse({ description: "TENANT_CONTEXT_MISSING or TENANT_SCOPE_FORBIDDEN" })
  async telegramSession(@Req() req: Request): Promise<{
    session_token: string;
    user_id: string;
    tenant_id: string;
    entry_mode: "telegram";
  }> {
    const meta: ArgumentMetadata = { type: "body", metatype: TelegramSessionDto };
    const dto = (await authInboundBodyPipe.transform(
      req.body,
      meta
    )) as TelegramSessionDto;
    return this.authService.createTelegramSession(req, dto);
  }

  @Get("workspaces")
  @ApiBearerAuth()
  @UseGuards(AuthorizationPresenceGuard)
  @ApiOperation({
    summary: "List workspaces for the authenticated user",
    description:
      "Returns tenant memberships from user_tenants joined to tenants (non-deleted). " +
      "Uses a tightly scoped read path with explicit user-bound constraints."
  })
  @ApiOkResponse({
    description: "Active memberships for the current user",
    type: AuthWorkspaceItemDto,
    isArray: true
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  async listWorkspaces(): Promise<AuthWorkspaceItemDto[]> {
    return this.workspaceService.listWorkspaces();
  }

  @Post("workspaces")
  @ApiBearerAuth()
  @UseGuards(AuthorizationPresenceGuard)
  @ApiOperation({
    summary: "Create workspace",
    description:
      "Creates a new workspace tenant with the provided name/subdomain and assigns the authenticated user as owner."
  })
  @ApiBody({ type: CreateWorkspaceDto })
  @ApiOkResponse({
    description: "Workspace created and owner membership assigned",
    type: AuthWorkspaceItemDto
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Tenant context or membership constraints failed" })
  async createWorkspace(@Body() dto: CreateWorkspaceDto): Promise<AuthWorkspaceItemDto> {
    return this.workspaceService.createWorkspace(dto);
  }

  @Post("workspace/session")
  @HttpCode(200)
  @UseGuards(AuthorizationPresenceGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Issue session JWT for a workspace tenant",
    description:
      "Uses JWT `sub` as the user, verifies membership via user_tenants, " +
      "and returns a new access token scoped to the requested tenant_id and role. " +
      "When the HTTP Host resolves to a workspace tenant, `tenant_id` must match that host tenant."
  })
  @ApiBody({ type: WorkspaceSessionDto })
  @ApiOkResponse({
    description: "New web session token for the selected tenant",
    type: WebSessionResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({
    description: "HTTP 403 — authenticated user is not a member of the requested tenant_id"
  })
  async workspaceSession(
    @Req() req: Request,
    @Body() dto: WorkspaceSessionDto
  ): Promise<{
    session_token: string;
    user_id: string;
    tenant_id: string;
    entry_mode: "web";
  }> {
    const userId = this.requestContextService.getUserId();
    if (!userId) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_UNAUTHENTICATED",
          message: "Authentication required"
        }
      });
    }
    const jwtTenantId = this.requestContextService.resolveEffectiveTenantId(req);
    if (!jwtTenantId) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_UNAUTHENTICATED",
          message: "Authentication required"
        }
      });
    }
    return this.authService.createWorkspaceSession(userId, dto, req.tenant, jwtTenantId);
  }

  @Post("link-telegram")
  @HttpCode(200)
  // Fail-closed: link operation requires explicit JWT + role authorization.
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Required idempotency key for link operation."
  })
  @ApiOperation({ summary: "Link Telegram identity to authenticated user" })
  @ApiBody({ type: LinkTelegramDto })
  @ApiOkResponse({
    description: "Telegram account linked successfully",
    type: LinkTelegramResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Authentication context missing" })
  @Roles(UserRole.Member, UserRole.Owner, UserRole.Admin, UserRole.Leader, UserRole.Viewer)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/auth/link-telegram",
    statusCode: 200,
    required: true,
    tenantSource: "context"
  })
  async linkTelegram(
    @Body() dto: LinkTelegramDto
  ): Promise<{
    user_id: string;
    linked_telegram_user_id: string;
    link_status: "Linked";
    linked_at: string;
  }> {
    const userId = this.requestContextService.getUserId();
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!userId || !tenantId) {
      throw new UnauthorizedException("AUTH_UNAUTHENTICATED");
    }
    return this.authService.linkTelegram(userId, tenantId, dto);
  }
}
