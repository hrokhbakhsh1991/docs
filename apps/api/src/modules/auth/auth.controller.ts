import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  ValidationPipe
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuthService } from "./auth.service";
import { LinkTelegramDto } from "./dto/link-telegram.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { Roles } from "./roles.decorator";
import { Role } from "./roles.enum";
import { RolesGuard } from "./roles.guard";
import { TelegramSessionDto } from "./dto/telegram-session.dto";
import { WebSessionDto } from "./dto/web-session.dto";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";

@ApiTags("Auth")
@Controller("api/v2/auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly requestContextService: RequestContextService
  ) {}

  @Post("web/session")
  @HttpCode(200)
  @ApiOperation({ summary: "Create web session token" })
  @ApiBody({ type: WebSessionDto })
  @ApiOkResponse({
    description: "Authenticated web session created"
  })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  async webSession(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: WebSessionDto
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
    description: "Authenticated Telegram session created"
  })
  @ApiUnauthorizedResponse({ description: "Invalid Telegram init payload" })
  async telegramSession(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: TelegramSessionDto
  ): Promise<{
    session_token: string;
    user_id: string;
    tenant_id: string;
    entry_mode: "telegram";
  }> {
    return this.authService.createTelegramSession(dto);
  }

  @Post("link-telegram")
  @HttpCode(200)
  // Fail-closed: link operation requires explicit JWT + role authorization.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Link Telegram identity to authenticated user" })
  @ApiBody({ type: LinkTelegramDto })
  @ApiOkResponse({ description: "Telegram account linked successfully" })
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
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: LinkTelegramDto
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
