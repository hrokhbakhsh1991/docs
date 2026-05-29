import type { INestApplication } from "@nestjs/common";
import type { TestingModuleBuilder } from "@nestjs/testing";
import {
  createApiE2eHarness,
  type ApiE2eHarnessContext,
  type ApiE2eHarnessOptions,
} from "@repo/testing-infra";
import { DataSource } from "typeorm";

import { createE2EApp } from "../bootstrap";
import {
  bumpMembershipSessionVersionByEmail,
  countWorkspaceInvitesByToken,
  findUserIdByEmail,
  hasActiveMembership,
  insertPendingWorkspaceInvite,
  updateMembershipRoleByEmail,
} from "../../helpers/auth-test-personas";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI,
} from "../jwt-test-keys";

import {
  createAuthSessionFactory,
  type AuthSessionFactory,
} from "./auth-session.factory";

export type CreateAuthE2eHarnessOptions = Omit<ApiE2eHarnessOptions, "jwtKeys"> & {
  jwtKeys?: ApiE2eHarnessOptions["jwtKeys"];
  seed?: (ds: DataSource) => Promise<void>;
  configureApp?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
};

export type AuthE2eDbHelpers = {
  updateMembershipRoleByEmail: (
    input: Parameters<typeof updateMembershipRoleByEmail>[1],
  ) => Promise<void>;
  bumpMembershipSessionVersionByEmail: (
    input: Parameters<typeof bumpMembershipSessionVersionByEmail>[1],
  ) => Promise<void>;
  findUserIdByEmail: (email: string) => Promise<string>;
  insertPendingWorkspaceInvite: (
    input: Parameters<typeof insertPendingWorkspaceInvite>[1],
  ) => Promise<void>;
  countWorkspaceInvitesByToken: (inviteToken: string) => Promise<number>;
  hasActiveMembership: (input: Parameters<typeof hasActiveMembership>[1]) => Promise<boolean>;
};

export type AuthE2eHarnessContext = ApiE2eHarnessContext & {
  app: INestApplication | undefined;
  auth: AuthSessionFactory | undefined;
  db: AuthE2eDbHelpers | undefined;
};

const defaultJwtKeys = {
  privatePem: E2E_JWT_PRIVATE_KEY_PKCS8,
  publicPem: E2E_JWT_PUBLIC_KEY_SPKI,
};

/**
 * Auth e2e lifecycle: Testcontainers → env → migrate → Nest app → optional seed → session factory.
 */
export async function createAuthE2eHarness(
  options: CreateAuthE2eHarnessOptions = {},
): Promise<AuthE2eHarnessContext> {
  const harnessOptions: ApiE2eHarnessOptions = {
    ...options,
    jwtKeys: options.jwtKeys ?? defaultJwtKeys,
  };

  const base = await createApiE2eHarness(harnessOptions);

  if (base.unavailableReason) {
    return {
      ...base,
      app: undefined,
      auth: undefined,
      db: undefined,
    };
  }

  base.applyEnv();
  await base.resetDatabase();

  const app = await createE2EApp(options.configureApp);
  if (options.seed) {
    await options.seed(app.get(DataSource));
  }

  const auth = createAuthSessionFactory(app);
  const ds = app.get(DataSource);
  const db: AuthE2eDbHelpers = {
    updateMembershipRoleByEmail: (input) => updateMembershipRoleByEmail(ds, input),
    bumpMembershipSessionVersionByEmail: (input) =>
      bumpMembershipSessionVersionByEmail(ds, input),
    findUserIdByEmail: (email) => findUserIdByEmail(ds, email),
    insertPendingWorkspaceInvite: (input) => insertPendingWorkspaceInvite(ds, input),
    countWorkspaceInvitesByToken: (token) => countWorkspaceInvitesByToken(ds, token),
    hasActiveMembership: (input) => hasActiveMembership(ds, input),
  };

  return {
    ...base,
    app,
    auth,
    db,
  };
}

export async function teardownAuthE2eHarness(ctx: AuthE2eHarnessContext): Promise<void> {
  if (ctx.app) {
    try {
      await ctx.app.close();
    } catch {
      /* Nest/redis shutdown races in Testcontainers e2e teardown */
    }
  }
  await ctx.teardown();
}
