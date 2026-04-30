import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuthService } from "./auth.service";
import { LinkTelegramDto } from "./dto/link-telegram.dto";
import { Roles } from "./roles.decorator";
import { Role } from "./roles.enum";
import { RolesGuard } from "./roles.guard";
import { TelegramSessionDto } from "./dto/telegram-session.dto";
import { WebSessionDto } from "./dto/web-session.dto";

@Controller("api/v2/auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly requestContextService: RequestContextService
  ) {}

  @Post("web/session")
  @HttpCode(200)
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
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.OWNER)
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
