/**
 * Idempotent RBAC rollout fixtures (prompt.md — WS1/WS2/WS3).
 *
 * Run after migrations:
 *   pnpm --filter @apps/api seed:rbac-rollout
 *
 * Refuses NODE_ENV=production unless ALLOW_RBAC_ROLLOUT_SEED=true.
 */
import * as argon2 from "argon2";
import { DataSource, IsNull, Repository } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { UserRole } from "../common/auth/user-role.enum";
import { MembershipStatus } from "../modules/identity/membership-status.enum";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";
import { WorkspaceDestinationEntity } from "../modules/settings-locations/entities/workspace-destination.entity";
import { WorkspaceRegionEntity } from "../modules/settings-locations/entities/workspace-region.entity";
import { emitScriptInfo } from "./script-log";

const DEFAULT_PASSWORD = "demo123";

type WorkspaceSeed = {
  key: string;
  subdomain: string;
  name: string;
  enabledModules: string[];
  regions: Array<{ code: string; name: string; country: string }>;
  users: Array<{
    email: string;
    role: UserRole;
    capabilities?: string[];
    allowedRegionIds?: string[];
    labels?: string[];
  }>;
};

const WORKSPACES: WorkspaceSeed[] = [
  {
    key: "WS1",
    subdomain: "ws1-rbac",
    name: "RBAC Rollout WS1",
    enabledModules: ["finance", "form_builder"],
    regions: [{ code: "NA", name: "North America", country: "US" }],
    users: [
      { email: "ws1-owner@test.com", role: UserRole.Owner },
      { email: "ws1-admin@test.com", role: UserRole.Admin },
      {
        email: "ws1-member@test.com",
        role: UserRole.Member,
        capabilities: ["tour.form.architect", "finance.reconciliation.review"],
      },
    ],
  },
  {
    key: "WS2",
    subdomain: "ws2-rbac",
    name: "RBAC Rollout WS2",
    enabledModules: ["finance"],
    regions: [
      { code: "US-EAST", name: "US East", country: "US" },
      { code: "US-WEST", name: "US West", country: "US" },
    ],
    users: [
      { email: "ws2-owner@test.com", role: UserRole.Owner },
      {
        email: "ws2-leader@test.com",
        role: UserRole.Leader,
        capabilities: ["tour.regional.manage"],
        allowedRegionIds: [],
      },
      { email: "ws2-member@test.com", role: UserRole.Member },
    ],
  },
  {
    key: "WS3",
    subdomain: "ws3-rbac",
    name: "RBAC Rollout WS3",
    enabledModules: ["form_builder"],
    regions: [{ code: "EU", name: "Europe", country: "DE" }],
    users: [
      { email: "ws3-owner@test.com", role: UserRole.Owner },
      { email: "ws3-admin@test.com", role: UserRole.Admin },
      {
        email: "ws3-member@test.com",
        role: UserRole.Member,
        capabilities: ["marketing.segment.read"],
      },
      { email: "ws3-viewer@test.com", role: UserRole.Viewer, labels: ["club_member"] },
    ],
  },
];

function fail(message: string): never {
  console.error(message);
  throw new Error(message);
}

async function upsertTenant(
  repo: Repository<TenantEntity>,
  spec: WorkspaceSeed,
): Promise<TenantEntity> {
  let tenant = await repo.findOne({
    where: { subdomain: spec.subdomain, deletedAt: IsNull() },
  });
  if (!tenant) {
    tenant = await repo.save(
      repo.create({
        name: spec.name,
        description: `RBAC rollout fixture ${spec.key}`,
        subdomain: spec.subdomain,
        enabledModules: [...spec.enabledModules],
      }),
    );
  } else {
    tenant.name = spec.name;
    tenant.enabledModules = [...spec.enabledModules];
    tenant = await repo.save(tenant);
  }
  return tenant;
}

async function upsertRegions(
  dataSource: DataSource,
  tenantId: string,
  regions: WorkspaceSeed["regions"],
): Promise<Map<string, string>> {
  const regionRepo = dataSource.getRepository(WorkspaceRegionEntity);
  const idByCode = new Map<string, string>();

  for (const [index, spec] of regions.entries()) {
    let row = await regionRepo.findOne({
      where: { tenantId, name: spec.name },
    });
    if (!row) {
      row = await regionRepo.save(
        regionRepo.create({
          tenantId,
          name: spec.name,
          country: spec.country,
          sortOrder: index,
          isActive: true,
        }),
      );
    }
    idByCode.set(spec.code, row.id);
  }
  return idByCode;
}

function uniquePhoneForEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  const suffix = String(hash % 10_000_000).padStart(7, "0");
  return `+1555${suffix}`;
}

async function upsertUser(
  userRepo: Repository<UserEntity>,
  email: string,
  passwordHash: string,
): Promise<UserEntity> {
  const normalized = email.trim().toLowerCase();
  const phone = uniquePhoneForEmail(normalized);
  let user = await userRepo.findOne({
    where: { email: normalized, deletedAt: IsNull() },
  });
  if (!user) {
    user = await userRepo.save(
      userRepo.create({
        email: normalized,
        phone,
        hashedPassword: passwordHash,
        fullName: normalized.split("@")[0] ?? "User",
        isEmailVerified: true,
        isPhoneVerified: true,
        telegramUserId: null,
      }),
    );
  } else if (user.phone?.trim() !== phone) {
    user.phone = phone;
    user = await userRepo.save(user);
  }
  return user;
}

async function upsertMembership(
  membershipRepo: Repository<UserTenantEntity>,
  input: {
    tenantId: string;
    userId: string;
    role: UserRole;
    capabilities?: string[];
    allowedRegionIds?: string[];
    labels?: string[];
  },
): Promise<void> {
  const metadata: Record<string, unknown> = {};
  if (input.capabilities && input.capabilities.length > 0) {
    metadata.capabilities = [...input.capabilities];
  }
  if (input.allowedRegionIds && input.allowedRegionIds.length > 0) {
    metadata.allowedRegionIds = [...input.allowedRegionIds];
  }

  const row = await membershipRepo.findOne({
    where: { tenantId: input.tenantId, userId: input.userId, deletedAt: IsNull() },
  });
  if (!row) {
    await membershipRepo.save(
      membershipRepo.create({
        tenantId: input.tenantId,
        userId: input.userId,
        role: input.role,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
        labels: input.labels ?? [],
        membershipMetadata: metadata,
      }),
    );
    return;
  }

  row.role = input.role;
  row.status = MembershipStatus.ACTIVE;
  row.labels = input.labels ?? row.labels ?? [];
  row.membershipMetadata = metadata;
  await membershipRepo.save(row);
}

async function run(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_RBAC_ROLLOUT_SEED !== "true") {
    fail(
      "seed-rbac-rollout: refusing production. Set ALLOW_RBAC_ROLLOUT_SEED=true after explicit review.",
    );
  }

  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [
      TenantEntity,
      UserEntity,
      UserTenantEntity,
      WorkspaceRegionEntity,
      WorkspaceDestinationEntity,
    ],
  });

  await dataSource.initialize();
  const tenantRepo = dataSource.getRepository(TenantEntity);
  const userRepo = dataSource.getRepository(UserEntity);
  const membershipRepo = dataSource.getRepository(UserTenantEntity);
  const passwordHash = await argon2.hash(DEFAULT_PASSWORD);

  const summary: Array<Record<string, unknown>> = [];

  try {
    for (const spec of WORKSPACES) {
      const tenant = await upsertTenant(tenantRepo, spec);
      const regionIds = await upsertRegions(dataSource, tenant.id, spec.regions);

      for (const userSpec of spec.users) {
        let allowedRegionIds = userSpec.allowedRegionIds;
        if (
          userSpec.capabilities?.includes("tour.regional.manage") &&
          (!allowedRegionIds || allowedRegionIds.length === 0)
        ) {
          allowedRegionIds = [...regionIds.values()];
        }

        const user = await upsertUser(userRepo, userSpec.email, passwordHash);
        await upsertMembership(membershipRepo, {
          tenantId: tenant.id,
          userId: user.id,
          role: userSpec.role,
          capabilities: userSpec.capabilities,
          allowedRegionIds,
          labels: userSpec.labels,
        });

        summary.push({
          workspace: spec.key,
          tenantId: tenant.id,
          subdomain: spec.subdomain,
          email: user.email,
          role: userSpec.role,
          capabilities: userSpec.capabilities ?? [],
          allowedRegionIds: allowedRegionIds ?? [],
          labels: userSpec.labels ?? [],
          enabledModules: tenant.enabledModules,
        });
      }
    }

    emitScriptInfo("=== seed-rbac-rollout summary ===");
    emitScriptInfo(JSON.stringify(summary, null, 2));
    emitScriptInfo(`Default password for all fixture users: ${DEFAULT_PASSWORD}`);
    emitScriptInfo("JWT: role + sess_ver only; capabilities hydrate from DB (membership_metadata).");
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error("seed-rbac-rollout failed:", error);
  process.exit(1);
});
