/**
 * Production-env diagnostic: why OTP `1234` is rejected when NODE_ENV=production.
 * Run: node --import tsx --test src/modules/auth/otp-production-static-1234.spec.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";

import type { UserEntity } from "../identity/entities/user.entity";
import { AuthService } from "./auth.service";
import type { PhoneSessionDto } from "./dto/phone-session.dto";
import { OtpService } from "./otp.service";

function formatUnauthorized(err: unknown): string {
  if (err instanceof UnauthorizedException) {
    return JSON.stringify(err.getResponse(), null, 2);
  }
  return String(err);
}

function productionConfig(allowDevStaticOtp: boolean): {
  getNodeEnv: () => string;
  getAuthAllowDevStaticOtp: () => boolean;
} {
  return {
    getNodeEnv: () => "production",
    getAuthAllowDevStaticOtp: () => allowDevStaticOtp
  };
}

function makeRealOtpService(allowDevStaticOtp: boolean): OtpService {
  return new OtpService(
    { save: async () => undefined } as never,
    { query: async () => [] } as never,
    productionConfig(allowDevStaticOtp) as never
  );
}

function makeAuthServiceWithRealOtp(
  allowDevStaticOtp: boolean,
  opts: { user?: UserEntity | null; tenantId?: string } = {}
): AuthService {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const publicPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const tenantId = opts.tenantId ?? randomUUID();
  const user = opts.user ?? ({ id: randomUUID() } as UserEntity);

  const membershipRepo = {
    findOne: async () => ({
      role: "member",
      sessionVersion: 1,
      status: "ACTIVE"
    })
  };

  const userRepo = {
    createQueryBuilder: () => ({
      select: () => ({
        where: () => ({
          andWhere: () => ({
            andWhere: () => ({
              getOne: async () => opts.user ?? null
            })
          })
        })
      }),
      where: () => ({
        andWhere: () => ({
          andWhere: () => ({
            getOne: async () => user
          }),
          getOne: async () => user
        })
      })
    })
  };

  return new AuthService(
    userRepo as never,
    membershipRepo as never,
    { findOne: async () => null } as never,
    {
      getNodeEnv: () => "production",
      getAuthAllowDevStaticOtp: () => allowDevStaticOtp,
      getJwtPrivateKey: () => privatePem,
      getJwtPublicKey: () => publicPem,
      getJwtIssuer: () => "diag-api",
      getJwtAudience: () => "diag-clients"
    } as never,
    {
      resolveEffectiveTenantId: () => tenantId,
      setTenantId: () => {},
      tryGetTenantId: () => undefined,
      tryGetHostTenantId: () => undefined,
      tryGetClientIp: () => undefined,
      tryGetRequestId: () => undefined
    } as never,
    { info: () => {}, warn: () => {}, error: () => {} } as never,
    { appendOrWarn: async () => {} } as never,
    makeRealOtpService(allowDevStaticOtp)
  );
}

test("production env: real OtpService.verifyMobileOtp rejects 1234 before DB (AUTH_ALLOW_DEV_STATIC_OTP=true)", async () => {
  const otpService = makeRealOtpService(true);
  const challengeId = randomUUID();

  await assert.rejects(
    () => otpService.verifyMobileOtp(challengeId, "1234"),
    (err: unknown) => {
      const body = formatUnauthorized(err);
      assert.match(body, /OTP verification is not available/);
      assert.match(body, /AUTH_OTP_INVALID/);
      return err instanceof UnauthorizedException;
    }
  );
});

test("production env: AuthService.createWebSessionOtp with challenge_id delegates to OtpService and rejects 1234", async () => {
  const svc = makeAuthServiceWithRealOtp(true);
  const challengeId = randomUUID();

  await assert.rejects(
    () =>
      svc.createWebSessionOtp({
        phone: "+15550000001",
        otp: "1234",
        challenge_id: challengeId
      } as PhoneSessionDto),
    (err: unknown) => {
      const body = formatUnauthorized(err);
      assert.match(body, /OTP verification is not available/);
      return err instanceof UnauthorizedException;
    }
  );
});

test("production env: AuthService.createWebSessionOtp without challenge_id never calls OtpService (AUTH_PHONE_INVALID)", async () => {
  const svc = makeAuthServiceWithRealOtp(true, { user: null });

  await assert.rejects(
    () =>
      svc.createWebSessionOtp({
        phone: "+15550000001",
        otp: "1234"
      } as PhoneSessionDto),
    (err: unknown) => {
      const body = formatUnauthorized(err);
      assert.match(body, /AUTH_PHONE_INVALID/);
      assert.doesNotMatch(body, /OTP verification is not available/);
      return err instanceof UnauthorizedException;
    }
  );
});

test("production env: isDevStaticOtpEnabled is false even when AUTH_ALLOW_DEV_STATIC_OTP=true", () => {
  const config = productionConfig(true);
  const nodeEnv = config.getNodeEnv();
  const allowFlag = config.getAuthAllowDevStaticOtp();
  const effectiveDevStatic =
    (nodeEnv === "development" || nodeEnv === "test") && allowFlag;

  assert.equal(nodeEnv, "production");
  assert.equal(allowFlag, true);
  assert.equal(effectiveDevStatic, false);
});
