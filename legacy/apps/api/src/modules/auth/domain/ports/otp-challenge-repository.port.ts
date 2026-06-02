export const OTP_CHALLENGE_REPOSITORY_PORT = Symbol("OTP_CHALLENGE_REPOSITORY_PORT");

export interface OtpChallengeRepositoryPort {
  markChallengeUsed(row: {
    id: string;
    mobile: string;
    purpose: import("../../mobile-otp.types").MobileOtpPurpose;
    expiresAt: Date;
    used: boolean;
  }): Promise<void>;
}
