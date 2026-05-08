import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { UserEntity } from "../identity/entities/user.entity";
import { AuthService } from "./auth.service";
import type { PhoneSessionDto } from "./dto/phone-session.dto";

function userRepoChain(result: UserEntity | null): {
  createQueryBuilder: () => {
    where: () => {
      andWhere: () => {
        andWhere: () => { getOne: () => Promise<UserEntity | null> };
        getOne: () => Promise<UserEntity | null>;
      };
    };
    select: () => {
      where: () => {
        andWhere: () => {
          andWhere: () => { getOne: () => Promise<UserEntity | null> };
        };
      };
    };
  };
} {
  return {
    createQueryBuilder: () => ({
      select: () => ({
        where: () => ({
          andWhere: () => ({
            andWhere: () => ({
              getOne: async () => null
            })
          })
        })
      }),
      where: () => ({
        andWhere: () => ({
          andWhere: () => ({
            getOne: async () => result
          }),
          getOne: async () => result
        })
      })
    })
  };
}

function makeAuthService(deps: {
  userRepo?: ReturnType<typeof userRepoChain>;
  membershipRepo?: { findOne: () => Promise<unknown> };
  workspaceInviteRepo?: {
    createQueryBuilder: () => {
      select: () => {
        where: () => {
          andWhere: () => {
            andWhere: () => {
              andWhere: () => { getRawOne: () => Promise<{ id: string } | null> };
              getRawOne: () => Promise<{ id: string } | null>;
            };
          };
        };
      };
    };
  };
  nodeEnv?: "development" | "test" | "production";
  allowDevStaticOtp?: boolean;
  requestContext?: {
    resolveEffectiveTenantId: () => string | undefined;
    setTenantId: (id: string) => void;
    tryGetTenantId?: () => string | undefined;
    tryGetHostTenantId?: () => string | undefined;
    tryGetClientIp?: () => string | undefined;
    tryGetRequestId?: () => string | undefined;
  };
}): AuthService {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048
  });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const userRepo = deps.userRepo ?? userRepoChain(null);
  const membershipRepo = deps.membershipRepo ?? { findOne: async () => null };
  const workspaceInviteRepo = deps.workspaceInviteRepo ?? {
    createQueryBuilder: () => ({
      select: () => ({
        where: () => ({
          andWhere: () => ({
            andWhere: () => ({
              andWhere: () => ({
                getRawOne: async () => null
              }),
              getRawOne: async () => null
            })
          })
        })
      })
    })
  };
  const requestContextBase = {
    resolveEffectiveTenantId: () => undefined,
    setTenantId: () => {},
    tryGetTenantId: () => undefined,
    tryGetHostTenantId: () => undefined,
    tryGetClientIp: () => undefined,
    tryGetRequestId: () => undefined
  };
  const requestContext = {
    ...requestContextBase,
    ...(deps.requestContext ?? {})
  };
  const nodeEnv = deps.nodeEnv ?? "test";
  const allowDevStaticOtp = deps.allowDevStaticOtp ?? true;
  return new AuthService(
    userRepo as never,
    membershipRepo as never,
    workspaceInviteRepo as never,
    {
      getNodeEnv: () => nodeEnv,
      getAuthAllowDevStaticOtp: () => allowDevStaticOtp,
      getJwtPrivateKey: () => privatePem,
      getJwtPublicKey: () => publicPem,
      getJwtIssuer: () => "dev-api",
      getJwtAudience: () => "dev-clients"
    } as never,
    requestContext as never,
    { info: () => {}, warn: () => {}, error: () => {} } as never,
    { appendOrWarn: async () => {} } as never
  );
}

test("validatePhoneOtp returns null when otp is not the dev static code", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const svc = makeAuthService({});
    assert.equal(await svc.validatePhoneOtp("+15550000001", "0000"), null);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("validatePhoneOtp returns null when phone is empty after trim", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const svc = makeAuthService({});
    assert.equal(await svc.validatePhoneOtp("   ", "1234"), null);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("validatePhoneOtp returns user from repository when otp is 1234 in non-production", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const user = { id: randomUUID() } as UserEntity;
    const svc = makeAuthService({ userRepo: userRepoChain(user) });
    const got = await svc.validatePhoneOtp("+15551111111", "1234");
    assert.equal(got, user);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("validatePhoneOtp returns null when static OTP is disabled", async () => {
  const svc = makeAuthService({ allowDevStaticOtp: false });
  assert.equal(await svc.validatePhoneOtp("+15550000001", "1234"), null);
});

test("createWebSessionOtp throws TENANT_CONTEXT_MISSING when tenant is not resolved", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const svc = makeAuthService({
      requestContext: {
        resolveEffectiveTenantId: () => undefined,
        setTenantId: () => {}
      }
    });
    await assert.rejects(
      () =>
        svc.createWebSessionOtp({
          phone: "+15550000001",
          otp: "1234"
        } as PhoneSessionDto),
      (err: unknown) =>
        err instanceof ForbiddenException &&
        (err.getResponse() as { error?: { code?: string } }).error?.code ===
          "TENANT_CONTEXT_MISSING"
    );
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("createWebSessionOtp throws AUTH_OTP_INVALID when OTP is invalid", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const tenantId = randomUUID();
    const svc = makeAuthService({
      requestContext: {
        resolveEffectiveTenantId: () => tenantId,
        setTenantId: () => {}
      }
    });
    await assert.rejects(
      () =>
        svc.createWebSessionOtp({
          phone: "+15550000001",
          otp: "bad"
        } as PhoneSessionDto),
      (err: unknown) =>
        err instanceof UnauthorizedException &&
        (err.getResponse() as { error?: { code?: string } }).error?.code === "AUTH_OTP_INVALID"
    );
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("createWebSessionOtp throws TENANT_SCOPE_FORBIDDEN when user has no membership", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const tenantId = randomUUID();
    const user = { id: randomUUID() } as UserEntity;
    const svc = makeAuthService({
      userRepo: userRepoChain(user),
      membershipRepo: { findOne: async () => null },
      requestContext: {
        resolveEffectiveTenantId: () => tenantId,
        setTenantId: () => {}
      }
    });
    await assert.rejects(
      () =>
        svc.createWebSessionOtp({
          phone: "+15550000001",
          otp: "1234"
        } as PhoneSessionDto),
      (err: unknown) =>
        err instanceof ForbiddenException &&
        (err.getResponse() as { error?: { code?: string } }).error?.code ===
          "AUTH_NO_ACTIVE_MEMBERSHIP"
    );
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("createWebSessionOtp returns session for existing user with ACTIVE membership", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const tenantId = randomUUID();
    const user = {
      id: randomUUID(),
      email: "user@example.com"
    } as UserEntity;
    const svc = makeAuthService({
      userRepo: userRepoChain(user),
      membershipRepo: {
        findOne: async () => ({
          role: "member",
          sessionVersion: 1,
          status: "ACTIVE"
        })
      },
      requestContext: {
        resolveEffectiveTenantId: () => tenantId,
        setTenantId: () => {}
      }
    });
    const result = await svc.createWebSessionOtp({
      phone: "+15550000001",
      otp: "1234"
    } as PhoneSessionDto);
    assert.equal(result.user_id, user.id);
    assert.equal(result.tenant_id, tenantId);
    assert.equal(result.entry_mode, "web");
    assert.equal(typeof result.session_token, "string");
    assert.equal(result.session_token.length > 0, true);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("createWebSessionOtp returns registration_required when phone does not map to an existing user", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const tenantId = randomUUID();
    const svc = makeAuthService({
      requestContext: {
        resolveEffectiveTenantId: () => tenantId,
        setTenantId: () => {}
      }
    });
    const result = await svc.createWebSessionOtp({
      phone: "+15550000001",
      otp: "1234"
    } as PhoneSessionDto);
    assert.equal(result.requires_registration, true);
    assert.equal(typeof result.onboarding_token, "string");
    assert.equal(result.tenant_id, tenantId);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("createWebSessionOtp fails when static OTP feature is disabled even with otp=1234", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const tenantId = randomUUID();
    const user = { id: randomUUID() } as UserEntity;
    const svc = makeAuthService({
      userRepo: userRepoChain(user),
      allowDevStaticOtp: false,
      requestContext: {
        resolveEffectiveTenantId: () => tenantId,
        setTenantId: () => {}
      }
    });
    await assert.rejects(
      () =>
        svc.createWebSessionOtp({
          phone: "+15550000001",
          otp: "1234"
        } as PhoneSessionDto),
      (err: unknown) =>
        err instanceof UnauthorizedException &&
        (err.getResponse() as { error?: { code?: string } }).error?.code === "AUTH_PHONE_INVALID"
    );
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("createWebSessionOtp returns AUTH_PHONE_INVALID for unknown phone in production", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const tenantId = randomUUID();
    const svc = makeAuthService({
      nodeEnv: "production",
      allowDevStaticOtp: false,
      requestContext: {
        resolveEffectiveTenantId: () => tenantId,
        setTenantId: () => {}
      }
    });
    await assert.rejects(
      () =>
        svc.createWebSessionOtp({
          phone: "+15550000001",
          otp: "1234"
        } as PhoneSessionDto),
      (err: unknown) =>
        err instanceof UnauthorizedException &&
        (err.getResponse() as { error?: { code?: string } }).error?.code === "AUTH_PHONE_INVALID"
    );
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("preflightPhone does not throw when workspace_invites missing invited_by_user_id column", async () => {
  const queryError = new Error('column wi.invited_by_user_id does not exist in relation "workspace_invites"');
  queryError.name = "QueryFailedError";
  const svc = makeAuthService({
    userRepo: userRepoChain({ id: randomUUID() } as UserEntity),
    workspaceInviteRepo: {
      createQueryBuilder: () => ({
        select: () => ({
          where: () => ({
            andWhere: () => ({
              andWhere: () => ({
                andWhere: () => ({
                  getRawOne: async () => {
                    throw queryError;
                  }
                }),
                getRawOne: async () => {
                  throw queryError;
                }
              })
            })
          })
        })
      })
    }
  });

  const result = await svc.preflightPhone({
    phone: "+15550000001"
  } as never);
  assert.equal(result.mode, "existing_user");
  assert.equal(result.invite_pending, false);
});
