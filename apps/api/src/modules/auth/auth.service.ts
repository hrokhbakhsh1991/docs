import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { SignJWT } from "jose";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { IsNull, Repository } from "typeorm";
import { loadPrivateKey } from "../../auth/jwt-key.util";
import { LoggerService } from "../../common/logger/logger.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { ConfigService } from "../../config/config.service";
import { UserEntity } from "../identity/entities/user.entity";
import { UserTenantEntity } from "../identity/entities/user-tenant.entity";
import type { LinkTelegramDto } from "./dto/link-telegram.dto";
import type { TelegramSessionDto } from "./dto/telegram-session.dto";
import type { WebSessionDto } from "./dto/web-session.dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserTenantEntity)
    private readonly userTenantRepository: Repository<UserTenantEntity>,
    private readonly configService: ConfigService,
    private readonly requestContextService: RequestContextService,
    private readonly loggerService: LoggerService
  ) {}

  private normalizeSignal(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  private resolveTrustedTenantId(
    signals: {
      web?: string;
      api?: string;
      backoffice?: string;
      telegram?: string;
    },
    assertedTenantId?: string
  ): string {
    const ordered = [
      this.normalizeSignal(signals.web),
      this.normalizeSignal(signals.api),
      this.normalizeSignal(signals.backoffice),
      this.normalizeSignal(signals.telegram)
    ].filter((v): v is string => Boolean(v));

    if (ordered.length === 0) {
      throw new ForbiddenException("TENANT_CONTEXT_MISSING");
    }

    const resolved = ordered[0];
    for (const signal of ordered.slice(1)) {
      if (signal !== resolved) {
        throw new ForbiddenException("TENANT_SCOPE_CONFLICT");
      }
    }

    const asserted = this.normalizeSignal(assertedTenantId);
    if (asserted && asserted !== resolved) {
      throw new ForbiddenException("TENANT_SCOPE_CONFLICT");
    }

    return resolved;
  }

  private parseTelegramInitPayload(
    telegramInitPayload: string
  ): { telegramUserId: string } {
    const params = new URLSearchParams(telegramInitPayload);
    const hash = params.get("hash");
    if (!hash) {
      throw new UnauthorizedException("AUTH_TELEGRAM_CONTEXT_REQUIRED");
    }

    const dataEntries: string[] = [];
    for (const [key, value] of params.entries()) {
      if (key !== "hash") {
        dataEntries.push(`${key}=${value}`);
      }
    }
    dataEntries.sort();
    const dataCheckString = dataEntries.join("\n");

    const secretKey = createHash("sha256")
      .update(this.configService.getTelegramBotToken(), "utf8")
      .digest();
    const computedHash = createHmac("sha256", secretKey)
      .update(dataCheckString, "utf8")
      .digest("hex");

    const provided = Buffer.from(hash, "hex");
    const computed = Buffer.from(computedHash, "hex");
    if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
      throw new UnauthorizedException("AUTH_TELEGRAM_CONTEXT_REQUIRED");
    }

    const userJson = params.get("user");
    if (!userJson) {
      throw new UnauthorizedException("AUTH_TELEGRAM_CONTEXT_REQUIRED");
    }

    try {
      const user = JSON.parse(userJson) as { id?: unknown };
      if (
        (typeof user.id !== "number" && typeof user.id !== "string") ||
        String(user.id).trim() === ""
      ) {
        throw new Error("invalid");
      }
      return { telegramUserId: String(user.id).trim() };
    } catch {
      throw new UnauthorizedException("AUTH_TELEGRAM_CONTEXT_REQUIRED");
    }
  }

  private async signAccessToken(input: {
    userId: string;
    tenantId: string;
    role: string;
    email?: string;
  }): Promise<string> {
    const privateKey = await loadPrivateKey(this.configService.getJwtPrivateKey());

    const payload: Record<string, string> = {
      tenant_id: input.tenantId,
      role: input.role
    };
    if (input.email) {
      payload.email = input.email;
    }

    return new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setSubject(input.userId)
      .setIssuer(this.configService.getJwtIssuer())
      .setAudience(this.configService.getJwtAudience())
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
  }

  async createWebSession(dto: WebSessionDto): Promise<{
    session_token: string;
    user_id: string;
    tenant_id: string;
    entry_mode: "web";
  }> {
    const email = dto.credential.email.trim().toLowerCase();
    const resolvedTenantId = this.resolveTrustedTenantId(
      { web: dto.asserted_tenant_id },
      dto.asserted_tenant_id
    );
    this.requestContextService.setTenantId(resolvedTenantId);

    const user = await this.userRepository.findOne({
      where: {
        email,
        deletedAt: IsNull()
      }
    });

    if (process.env.AUTH_DEBUG_LOG === "true") {
      console.log("[AUTH_DEBUG] web/session user found:", Boolean(user));
    }

    if (!user) {
      throw new UnauthorizedException("AUTH_UNAUTHENTICATED");
    }

    const validPassword = await argon2.verify(
      user.hashedPassword,
      dto.credential.password
    );

    if (process.env.AUTH_DEBUG_LOG === "true") {
      console.log("[AUTH_DEBUG] web/session password match (argon2):", validPassword);
    }

    if (!validPassword) {
      throw new UnauthorizedException("AUTH_UNAUTHENTICATED");
    }

    const membership = await this.userTenantRepository.findOne({
      where: {
        userId: user.id,
        tenantId: resolvedTenantId,
        deletedAt: IsNull()
      }
    });

    if (process.env.AUTH_DEBUG_LOG === "true") {
      console.log("[AUTH_DEBUG] web/session role:", membership?.role ?? "(no membership)");
      console.log("[AUTH_DEBUG] web/session tenantId:", resolvedTenantId);
    }

    if (!membership) {
      this.loggerService.warn("tenant scope conflict during web session", {
        userId: user.id,
        tenantId: resolvedTenantId
      });
      throw new ForbiddenException("TENANT_SCOPE_CONFLICT");
    }

    const accessToken = await this.signAccessToken({
      userId: user.id,
      tenantId: resolvedTenantId,
      role: membership.role,
      email: user.email
    });

    return {
      session_token: accessToken,
      user_id: user.id,
      tenant_id: resolvedTenantId,
      entry_mode: "web"
    };
  }

  async createTelegramSession(dto: TelegramSessionDto): Promise<{
    session_token: string;
    user_id: string;
    tenant_id: string;
    entry_mode: "telegram";
  }> {
    const { telegramUserId } = this.parseTelegramInitPayload(
      dto.telegram_init_payload
    );

    const resolvedTenantId = this.resolveTrustedTenantId(
      { telegram: dto.asserted_tenant_id },
      dto.asserted_tenant_id
    );

    let user = await this.userRepository.findOne({
      where: {
        telegramUserId,
        deletedAt: IsNull()
      }
    });

    if (!user) {
      user = await this.userRepository.save(
        this.userRepository.create({
          email: `telegram_${telegramUserId}@local.invalid`,
          hashedPassword: await argon2.hash(randomUUID()),
          telegramUserId
        })
      );
    }

    this.requestContextService.setTenantId(resolvedTenantId);

    const membership = await this.userTenantRepository.findOne({
      where: {
        userId: user.id,
        tenantId: resolvedTenantId,
        deletedAt: IsNull()
      }
    });

    if (!membership) {
      throw new ForbiddenException("TENANT_SCOPE_FORBIDDEN");
    }

    const accessToken = await this.signAccessToken({
      userId: user.id,
      tenantId: resolvedTenantId,
      role: membership.role,
      email: user.email
    });

    return {
      session_token: accessToken,
      user_id: user.id,
      tenant_id: resolvedTenantId,
      entry_mode: "telegram"
    };
  }

  async linkTelegram(
    userId: string,
    sessionTenantId: string,
    dto: LinkTelegramDto
  ): Promise<{
    user_id: string;
    linked_telegram_user_id: string;
    link_status: "Linked";
    linked_at: string;
  }> {
    const { telegramUserId } = this.parseTelegramInitPayload(
      dto.telegram_init_payload
    );

    const resolvedTenantId = this.resolveTrustedTenantId({
      api: sessionTenantId
    });
    this.requestContextService.setTenantId(resolvedTenantId);

    const membership = await this.userTenantRepository.findOne({
      where: {
        userId,
        tenantId: resolvedTenantId,
        deletedAt: IsNull()
      }
    });

    if (!membership) {
      throw new ForbiddenException("TENANT_SCOPE_FORBIDDEN");
    }

    const currentUser = await this.userRepository.findOne({
      where: {
        id: userId,
        deletedAt: IsNull()
      }
    });
    if (!currentUser) {
      throw new UnauthorizedException("AUTH_UNAUTHENTICATED");
    }

    const linkedToAnother = await this.userRepository.findOne({
      where: {
        telegramUserId,
        deletedAt: IsNull()
      }
    });
    if (linkedToAnother && linkedToAnother.id !== userId) {
      throw new BadRequestException("STATE_TRANSITION_INVALID");
    }

    if (
      currentUser.telegramUserId &&
      currentUser.telegramUserId !== telegramUserId
    ) {
      throw new BadRequestException("STATE_TRANSITION_INVALID");
    }

    currentUser.telegramUserId = telegramUserId;
    await this.userRepository.save(currentUser);

    return {
      user_id: userId,
      linked_telegram_user_id: telegramUserId,
      link_status: "Linked",
      linked_at: new Date().toISOString()
    };
  }
}
