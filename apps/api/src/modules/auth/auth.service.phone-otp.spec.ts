import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { normalizeOtpPhoneInput } from "../../common/phone/otp-phone-normalize";
import type { UserEntity } from "../identity/entities/user.entity";
import { AuthService } from "./auth.service";
import type { PhoneSessionDto } from "./dto/phone-session.dto";

function membershipRepoActive(): {
  findOne: () => Promise<{ role: string; sessionVersion: number; status: string }>;
  createQueryBuilder: () => {
    innerJoin: () => {
      select: () => {
        addSelect: () => {
          addSelect: () => {
            addSelect: () => {
              addSelect: () => {
                where: () => {
                  andWhere: () => {
                    andWhere: () => {
                      andWhere: () => {
                        getRawOne: () => Promise<{
                          role: string;
                          session_version: number;
                          labels: null;
                          membership_metadata: null;
                          enabled_modules: null;
                        }>;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
} {
  const activeMembershipRow = {
    role: "member",
    session_version: 1,
    labels: null,
    membership_metadata: null,
    enabled_modules: null
  };
  return {
    findOne: async () => ({
      role: "member",
      sessionVersion: 1,
      status: "ACTIVE"
    }),
    createQueryBuilder: () => ({
      innerJoin: () => ({
        select: () => ({
          addSelect: () => ({
            addSelect: () => ({
              addSelect: () => ({
                addSelect: () => ({
                  where: () => ({
                    andWhere: () => ({
                      andWhere: () => ({
                        andWhere: () => ({
                          getRawOne: async () => activeMembershipRow
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  };
}

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
    setTenantId: (_id: string) => void;
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
  const membershipRepo = deps.membershipRepo ?? membershipRepoActive();
  const userRepo = deps.userRepo ?? userRepoChain(null);
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
  const otpServiceStub = {
    createMobileOtpChallenge: async (_mobile: string, _purpose: "login" | "change_mobile") => ({
      challengeId: randomUUID()
    }),
    verifyMobileOtp: async (_challengeId: string, code: string) => {
      if (code.trim() !== "1234") {
        throw new UnauthorizedException({
          error: { code: "AUTH_OTP_INVALID", message: "Invalid OTP code" }
        });
      }
      return {
        success: true as const,
        mobile: normalizeOtpPhoneInput("+15550000001"),
        purpose: "login" as const
      };
    }
  };
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
    { appendOrWarn: async () => {} } as never,
    otpServiceStub as never
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

test("createWebSessionOtp returns registration_required when user has no workspace membership", async () => {
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
      membershipRepo: membershipRepoActive(),
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

test("createWebSessionOtp returns registration_required for new user when challenge_id verifies OTP", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const tenantId = randomUUID();
    const challengeId = randomUUID();
    const svc = makeAuthService({
      nodeEnv: "production",
      allowDevStaticOtp: false,
      requestContext: {
        resolveEffectiveTenantId: () => tenantId,
        setTenantId: () => {}
      }
    });
    const result = await svc.createWebSessionOtp({
      phone: "+15550000001",
      otp: "1234",
      challenge_id: challengeId
    } as PhoneSessionDto);
    assert.equal(result.requires_registration, true);
    assert.equal(typeof result.onboarding_token, "string");
    assert.equal(result.tenant_id, tenantId);
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

function userRepoForCompleteRegistration(options: {
  existingUser?: UserEntity | null;
  onSave?: (_user: UserEntity) => void;
}): {
  createQueryBuilder: ReturnType<typeof userRepoChain>["createQueryBuilder"];
  create: (_input: Partial<UserEntity>) => UserEntity;
  save: (_user: UserEntity) => Promise<UserEntity>;
} {
  const existing = options.existingUser ?? null;
  return {
    createQueryBuilder: userRepoChain(existing).createQueryBuilder,
    create: (input) =>
      ({
        id: randomUUID(),
        ...input
      }) as UserEntity,
    save: async (user) => {
      options.onSave?.(user);
      return user;
    }
  };
}

function membershipRepoForCompleteRegistration(options?: {
  existing?: { role: string; sessionVersion: number; status: string } | null;
}): ReturnType<typeof membershipRepoActive> & {
  create: (_input: Record<string, unknown>) => Record<string, unknown>;
  save: (_row: Record<string, unknown>) => Promise<Record<string, unknown>>;
} {
  const existing = options?.existing ?? null;
  const base = membershipRepoActive();
  return {
    ...base,
    findOne: async () => existing,
    create: (input) => input,
    save: async (row) => row
  };
}

test("completeRegistration creates phone-first user with null email when email omitted", async () => {
  const tenantId = randomUUID();
  let savedUser: UserEntity | undefined;
  const svc = makeAuthService({
    userRepo: userRepoForCompleteRegistration({
      onSave: (user) => {
        savedUser = user;
      }
    }),
    membershipRepo: membershipRepoForCompleteRegistration(),
    requestContext: {
      resolveEffectiveTenantId: () => tenantId,
      setTenantId: () => {}
    }
  });

  const onboarding = await svc.createWebSessionOtp({
    phone: "+989123456789",
    otp: "1234"
  } as PhoneSessionDto);
  assert.equal(onboarding.requires_registration, true);
  assert.equal(typeof onboarding.onboarding_token, "string");

  const session = await svc.completeRegistration({
    onboarding_token: onboarding.onboarding_token!,
    full_name: "علی جهانی"
  });

  assert.equal(typeof session.session_token, "string");
  assert.equal(session.tenant_id, tenantId);
  assert.equal(session.entry_mode, "web");
  assert.equal(savedUser?.email, null);
  assert.equal(savedUser?.fullName, "علی جهانی");
  assert.equal(savedUser?.phone, "+989123456789");
  assert.equal(savedUser?.isPhoneVerified, true);
});

test("completeRegistration persists optional email when provided at signup", async () => {
  const tenantId = randomUUID();
  let savedUser: UserEntity | undefined;
  const svc = makeAuthService({
    userRepo: userRepoForCompleteRegistration({
      onSave: (user) => {
        savedUser = user;
      }
    }),
    membershipRepo: membershipRepoForCompleteRegistration(),
    requestContext: {
      resolveEffectiveTenantId: () => tenantId,
      setTenantId: () => {}
    }
  });

  const onboarding = await svc.createWebSessionOtp({
    phone: "+989123456780",
    otp: "1234"
  } as PhoneSessionDto);

  await svc.completeRegistration({
    onboarding_token: onboarding.onboarding_token!,
    full_name: "Jane Operator",
    email: "jane@example.com"
  });

  assert.equal(savedUser?.email, "jane@example.com");
  assert.equal(savedUser?.fullName, "Jane Operator");
});
