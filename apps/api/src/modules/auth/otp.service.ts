import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { DataSource, Repository } from "typeorm";

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
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

    await this.dataSource.query(
      `INSERT INTO mobile_otp_challenges (id, mobile, purpose, expires_at, used)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, normalized, purpose, expiresAt, false]
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

    const rows = (await this.dataSource.query(
      `SELECT id, mobile, purpose, expires_at AS "expiresAt", used
       FROM mobile_otp_challenges
       WHERE id = $1
       LIMIT 1`,
      [challengeId.trim()]
    )) as Array<{
      id: string;
      mobile: string;
      purpose: MobileOtpPurpose;
      expiresAt: Date;
      used: boolean;
    }>;
    const row = rows[0];
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
