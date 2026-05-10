import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "node:crypto";
import { IsNull, MoreThan, Repository } from "typeorm";

import { EmailService } from "../../common/email/email.service";
import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { normalizeOtpPhoneInput } from "../../common/phone/otp-phone-normalize";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { OtpService } from "../auth/otp.service";
import type { PatchMeDto } from "./dto/patch-me.dto";
import { EmailVerificationTokenEntity } from "./entities/email-verification-token.entity";
import { UserEntity } from "./entities/user.entity";
import { UsersAccessService } from "./users-access.service";

export type MeProfileResponse = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_email_verified: boolean;
  phone: string | null;
  is_phone_verified: boolean;
  notifications_enabled: boolean;
};

export type PendingEmailVerificationResponse = {
  status: "pending_email_verification";
};

export type EmailVerifiedResponse = {
  status: "email_verified";
  email: string;
};

export type MobileChangedResponse = {
  status: "mobile_changed";
  mobile: string;
};

@Injectable()
export class MeService {
  private static readonly EMAIL_TOKEN_TTL_MS = 30 * 60 * 1000;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(EmailVerificationTokenEntity)
    private readonly emailVerificationTokenRepository: Repository<EmailVerificationTokenEntity>,
    private readonly usersAccess: UsersAccessService,
    private readonly requestContext: RequestContextService,
    private readonly emailService: EmailService,
    private readonly otpService: OtpService
  ) {}

  private resolveSelfOrThrow(): { tenantId: string; userId: string } {
    const tenantId = this.requestContext.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    const userId = this.requestContext.getUserId();
    if (!userId) {
      throw new ForbiddenException(authRequiredError());
    }
    return { tenantId, userId };
  }

  private toProfileResponse(user: UserEntity): MeProfileResponse {
    const rawPhone = user.phone?.trim() ?? "";
    return {
      id: user.id,
      full_name: user.fullName ?? null,
      email: user.email ?? null,
      is_email_verified: user.isEmailVerified === true,
      phone: rawPhone === "" ? null : normalizeOtpPhoneInput(rawPhone),
      is_phone_verified: user.isPhoneVerified === true,
      notifications_enabled: user.notificationsEnabled === true
    };
  }

  async getMe(): Promise<MeProfileResponse> {
    const { tenantId, userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(tenantId, userId);

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    if (!user) {
      throw new NotFoundException({
        error: { code: "USER_NOT_FOUND", message: "User not found" }
      });
    }

    return this.toProfileResponse(user);
  }

  async patchMe(dto: PatchMeDto): Promise<MeProfileResponse | PendingEmailVerificationResponse> {
    const { tenantId, userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(tenantId, userId);

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    if (!user) {
      throw new NotFoundException({
        error: { code: "USER_NOT_FOUND", message: "User not found" }
      });
    }

    if (dto.full_name !== undefined) {
      user.fullName = dto.full_name;
    }

    if (dto.notifications_enabled !== undefined) {
      user.notificationsEnabled = dto.notifications_enabled;
    }

    const emailChangeRequested =
      dto.email !== undefined && dto.email.trim().toLowerCase() !== user.email.trim().toLowerCase();

    if (emailChangeRequested) {
      const next = dto.email!.trim();
      const taken = await this.userRepository.findOne({
        where: { email: next, deletedAt: IsNull() }
      });
      if (taken && taken.id !== user.id) {
        throw new ConflictException({
          error: {
            code: "USER_EMAIL_CONFLICT",
            message: "Email is already in use"
          }
        });
      }

      await this.userRepository.save(user);

      await this.emailVerificationTokenRepository.delete({
        userId: user.id,
        usedAt: IsNull()
      });

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + MeService.EMAIL_TOKEN_TTL_MS);

      await this.emailVerificationTokenRepository.save(
        this.emailVerificationTokenRepository.create({
          userId: user.id,
          newEmail: next,
          token,
          expiresAt,
          usedAt: null
        })
      );

      await this.emailService.sendVerificationEmail(next, token);

      return { status: "pending_email_verification" };
    }

    await this.userRepository.save(user);

    return this.toProfileResponse(user);
  }

  async verifyEmail(token: string): Promise<EmailVerifiedResponse> {
    const { tenantId, userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(tenantId, userId);

    const trimmed = token.trim();
    const row = await this.emailVerificationTokenRepository.findOne({
      where: {
        token: trimmed,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date())
      }
    });

    if (!row || row.userId !== userId) {
      throw new BadRequestException({
        error: {
          code: "EMAIL_VERIFICATION_INVALID",
          message: "Invalid or expired verification token"
        }
      });
    }

    const taken = await this.userRepository.findOne({
      where: { email: row.newEmail, deletedAt: IsNull() }
    });
    if (taken && taken.id !== userId) {
      throw new ConflictException({
        error: {
          code: "USER_EMAIL_CONFLICT",
          message: "Email is already in use"
        }
      });
    }

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    if (!user) {
      throw new NotFoundException({
        error: { code: "USER_NOT_FOUND", message: "User not found" }
      });
    }

    user.email = row.newEmail;
    user.isEmailVerified = true;
    await this.userRepository.save(user);

    row.usedAt = new Date();
    await this.emailVerificationTokenRepository.save(row);

    return { status: "email_verified", email: user.email };
  }

  private async findUserByNormalizedPhoneExclusive(
    normalizedPhone: string,
    excludeUserId: string
  ): Promise<UserEntity | null> {
    return this.userRepository
      .createQueryBuilder("u")
      .where("u.deleted_at IS NULL")
      .andWhere("u.id != :excludeUserId", { excludeUserId })
      .andWhere("phone_normalized(u.phone) = phone_normalized(:phone)", { phone: normalizedPhone })
      .getOne();
  }

  async requestChangeMobile(newMobile: string): Promise<{ challenge_id: string }> {
    const { tenantId, userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(tenantId, userId);

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    if (!user) {
      throw new NotFoundException({
        error: { code: "USER_NOT_FOUND", message: "User not found" }
      });
    }

    const normalized = normalizeOtpPhoneInput(newMobile.trim());
    if (user.phone && normalizeOtpPhoneInput(user.phone) === normalized) {
      throw new BadRequestException({
        error: {
          code: "USER_PHONE_UNCHANGED",
          message: "New mobile matches your current number"
        }
      });
    }

    const taken = await this.findUserByNormalizedPhoneExclusive(normalized, userId);
    if (taken) {
      throw new ConflictException({
        error: {
          code: "USER_PHONE_CONFLICT",
          message: "Phone number is already in use"
        }
      });
    }

    const { challengeId } = await this.otpService.createMobileOtpChallenge(normalized, "change_mobile");
    return { challenge_id: challengeId };
  }

  async verifyChangeMobile(challengeId: string, code: string): Promise<MobileChangedResponse> {
    const { tenantId, userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(tenantId, userId);

    let verified: { success: true; mobile: string; purpose: "login" | "change_mobile" };
    try {
      verified = await this.otpService.verifyMobileOtp(challengeId, code);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) {
        const body = err.getResponse();
        throw new BadRequestException(typeof body === "object" && body !== null ? body : { error: { message: "Invalid OTP" } });
      }
      throw err;
    }

    if (verified.purpose !== "change_mobile") {
      throw new BadRequestException({
        error: {
          code: "MOBILE_OTP_INVALID_PURPOSE",
          message: "OTP challenge is not for mobile change"
        }
      });
    }

    const taken = await this.findUserByNormalizedPhoneExclusive(verified.mobile, userId);
    if (taken) {
      throw new ConflictException({
        error: {
          code: "USER_PHONE_CONFLICT",
          message: "Phone number is already in use"
        }
      });
    }

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    if (!user) {
      throw new NotFoundException({
        error: { code: "USER_NOT_FOUND", message: "User not found" }
      });
    }

    user.phone = verified.mobile;
    user.isPhoneVerified = true;
    await this.userRepository.save(user);

    return { status: "mobile_changed", mobile: verified.mobile };
  }
}
