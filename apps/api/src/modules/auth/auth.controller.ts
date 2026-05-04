import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuthService } from "./auth.service";
import { WorkspaceService } from "./workspace.service";
import { LinkTelegramDto } from "./dto/link-telegram.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { Roles } from "./roles.decorator";
import { Role } from "./roles.enum";
import { RolesGuard } from "./roles.guard";
import { TelegramSessionDto } from "./dto/telegram-session.dto";
import { WebSessionDto } from "./dto/web-session.dto";
import { WorkspaceSessionDto } from "./dto/workspace-session.dto";
import {
  LinkTelegramResponseDto,
  TelegramSessionResponseDto,
  WebSessionResponseDto
} from "./dto/auth-session-response.dto";
import { AuthWorkspaceItemDto } from "./dto/auth-workspace-item.dto";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";

@ApiTags("Auth")
@Controller("api/v2/auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly workspaceService: WorkspaceService,
    private readonly requestContextService: RequestContextService
  ) {}

  @Post("web/session")
  @HttpCode(200)
  @ApiOperation({ summary: "Create web session token" })
  @ApiBody({ type: WebSessionDto })
  @ApiOkResponse({
    description: "Authenticated web session created",
    type: WebSessionResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  async webSession(
    @Body() dto: WebSessionDto
  ): Promise<{
    session_token: string;
    user_id: string;
    tenant_id: string;
    entry_mode: "web";
  }> {
    return this.authService.createWebSession(dto);
  }

  @Post("telegram/session")
  @HttpCode(200)
  @ApiOperation({ summary: "Create Telegram session token" })
  @ApiBody({ type: TelegramSessionDto })
  @ApiOkResponse({
    description: "Authenticated Telegram session created",
    type: TelegramSessionResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Invalid Telegram init payload" })
  async telegramSession(
    @Body() dto: TelegramSessionDto
  ): Promise<{
    session_token: string;
    user_id: string;
    tenant_id: string;
    entry_mode: "telegram";
  }> {
    return this.authService.createTelegramSession(dto);
  }

  @Get("workspaces")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "List workspaces for the authenticated user",
    description:
      "Returns tenant memberships from user_tenants joined to tenants (non-deleted). " +
      "Reads via SECURITY DEFINER function list_user_workspaces_for_auth so rows are not hidden by tenant RLS."
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

  @Post("workspace/session")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Issue session JWT for a workspace tenant",
    description:
      "Uses JWT `sub` as the user, verifies membership via user_tenants (definer function), " +
      "and returns a new access token scoped to the requested tenant_id and role."
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
    return this.authService.createWorkspaceSession(userId, dto);
  }

  @Post("link-telegram")
  @HttpCode(200)
  // Fail-closed: link operation requires explicit JWT + role authorization.
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles(Role.MEMBER, Role.OWNER)
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
    const tenantId = this.requestContextService.getTenantId();
    if (!userId || !tenantId) {
      throw new UnauthorizedException("AUTH_UNAUTHENTICATED");
    }
    return this.authService.linkTelegram(userId, tenantId, dto);
  }
}
