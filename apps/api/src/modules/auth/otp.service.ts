import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";

import { normalizeOtpPhoneInput } from "../../common/phone/otp-phone-normalize";
import { ConfigService } from "../../config/config.service";
import type { MobileOtpPurpose } from "./entities/mobile-otp-challenge.entity";
import { MobileOtpChallengeEntity } from "./entities/mobile-otp-challenge.entity";

const DEV_STATIC_OTP = "1234";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(MobileOtpChallengeEntity)
    private readonly challengeRepository: Repository<MobileOtpChallengeEntity>,
    private readonly configService: ConfigService
  ) {}

  private isDevStaticOtpEnabled(): boolean {
    const nodeEnv = this.configService.getNodeEnv();
    return (
      (nodeEnv === "development" || nodeEnv === "test") &&
      this.configService.getAuthAllowDevStaticOtp()
    );
  }

  async createMobileOtpChallenge(
    mobile: string,
    purpose: MobileOtpPurpose
  ): Promise<{ challengeId: string }> {
    const normalized = normalizeOtpPhoneInput(mobile);
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    await this.challengeRepository.save(
      this.challengeRepository.create({
        id,
        mobile: normalized,
        purpose,
        expiresAt,
        used: false
      })
    );

    return { challengeId: id };
  }

  async verifyMobileOtp(
    challengeId: string,
    code: string
  ): Promise<{ success: true; mobile: string; purpose: MobileOtpPurpose }> {
    if (!this.isDevStaticOtpEnabled()) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_OTP_INVALID",
          message: "OTP verification is not available"
        }
      });
    }

    const trimmedCode = typeof code === "string" ? code.trim() : "";
    if (trimmedCode !== DEV_STATIC_OTP) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_OTP_INVALID",
          message: "Invalid OTP code"
        }
      });
    }

    const row = await this.challengeRepository.findOne({ where: { id: challengeId.trim() } });
    if (!row) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_OTP_INVALID",
          message: "Invalid or expired OTP challenge"
        }
      });
    }
    if (row.used) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_OTP_INVALID",
          message: "OTP challenge already used"
        }
      });
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_OTP_INVALID",
          message: "OTP challenge expired"
        }
      });
    }

    row.used = true;
    await this.challengeRepository.save(row);

    return { success: true, mobile: row.mobile, purpose: row.purpose };
  }
}
