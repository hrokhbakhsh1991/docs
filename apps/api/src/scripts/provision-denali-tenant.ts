/**
 * Idempotent provision for workspace tenant **Denali** (subdomain `denali`).
 *
 * - Tenant + `form_builder` / `finance` modules (Tour Create Wizard at `/tours/new`)
 * - Default tour themes: mountain_outdoor, nature_trip (day trips), cinema_event (short sessions)
 * - Workspace tour-creation presets aligned to those profiles
 * - Global owner user (requested id `01234567890` → fixture UUID below)
 * - Minimal region + destination when catalog is empty
 *
 * Run (from repo root):
 *   pnpm --filter @apps/api provision:denali
 *
 * Optional follow-ups:
 *   ALLOW_DENALI_SEED=1 pnpm --filter @apps/api seed:denali-locations
 *   ALLOW_DENALI_SEED=1 pnpm --filter @apps/api seed:denali-equipment
 */
import * as argon2 from "argon2";
import { DataSource, IsNull, Repository } from "typeorm";

import type { DenaliTourKind, TourFormProfile } from "@repo/types";
import {
  DENALI_OWNER_EMAIL,
  DENALI_OWNER_NATIONAL_ID,
  DENALI_OWNER_REQUESTED_ID,
  DENALI_OWNER_USER_ID,
  DENALI_PROFILE_ALIASES,
  DENALI_SUBDOMAIN,
  DENALI_TENANT_NAME,
  DENALI_THEME_SEEDS,
} from "./denali-tenant.fixture";
export {
  DENALI_OWNER_NATIONAL_ID,
  DENALI_OWNER_REQUESTED_ID,
  DENALI_OWNER_USER_ID,
  DENALI_PROFILE_ALIASES,
  DENALI_SUBDOMAIN,
  DENALI_THEME_SEEDS,
} from "./denali-tenant.fixture";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { UserRole } from "../common/auth/user-role.enum";
import { MembershipStatus } from "../modules/identity/membership-status.enum";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";
import { WorkspaceDestinationEntity } from "../modules/settings-locations/entities/workspace-destination.entity";
import { WorkspaceRegionEntity } from "../modules/settings-locations/entities/workspace-region.entity";
import { WorkspaceTourThemeEntity } from "../modules/settings-locations/entities/workspace-tour-theme.entity";
import { emitScriptInfo } from "./script-log";
import { buildDenaliPresetDefaults } from "./denali-preset-seeds";
import { upsertWorkspaceWizardTemplate } from "./upsert-workspace-wizard-template";

const DENALI_OWNER_PHONE = "+989121000001";
const DENALI_OWNER_PASSWORD = "demo123";

type PresetSeed = {
  sortOrder: number;
  name: string;
  description: string;
  formProfile: TourFormProfile;
  kind: DenaliTourKind;
  matchTourType: string | null;
  themeSlug: string;
};

function fail(message: string): never {
  console.error(message);
  throw new Error(message);
}

async function upsertTenant(repo: Repository<TenantEntity>): Promise<TenantEntity> {
  let tenant = await repo.findOne({
    where: { subdomain: DENALI_SUBDOMAIN, deletedAt: IsNull() },
  });
  const enabledModules = ["form_builder", "finance"];
  if (!tenant) {
    tenant = await repo.save(
      repo.create({
        name: DENALI_TENANT_NAME,
        description: "Denali workspace — tour create wizard (mountain, nature day trips, short sessions)",
        subdomain: DENALI_SUBDOMAIN,
        enabledModules,
      }),
    );
    emitScriptInfo(`Created tenant ${DENALI_TENANT_NAME} (${DENALI_SUBDOMAIN}) id=${tenant.id}`);
  } else {
    tenant.name = DENALI_TENANT_NAME;
    tenant.enabledModules = enabledModules;
    tenant.description =
      tenant.description ??
      "Denali workspace — tour create wizard (mountain, nature day trips, short sessions)";
    tenant = await repo.save(tenant);
    emitScriptInfo(`Updated tenant ${DENALI_TENANT_NAME} id=${tenant.id}`);
  }
  return tenant;
}

async function upsertOwnerUser(
  userRepo: Repository<UserEntity>,
  passwordHash: string,
): Promise<UserEntity> {
  let user = await userRepo.findOne({
    where: { id: DENALI_OWNER_USER_ID, deletedAt: IsNull() },
  });
  if (!user) {
    user = await userRepo.findOne({
      where: { email: DENALI_OWNER_EMAIL, deletedAt: IsNull() },
    });
  }
  if (!user) {
    user = await userRepo.save(
      userRepo.create({
        id: DENALI_OWNER_USER_ID,
        email: DENALI_OWNER_EMAIL,
        phone: DENALI_OWNER_PHONE,
        hashedPassword: passwordHash,
        fullName: "Denali Global Owner",
        nationalId: DENALI_OWNER_NATIONAL_ID,
        isEmailVerified: true,
        isPhoneVerified: true,
        telegramUserId: null,
      }),
    );
    emitScriptInfo(`Created owner user id=${user.id} national_id=${DENALI_OWNER_REQUESTED_ID}`);
  } else {
    user.email = DENALI_OWNER_EMAIL;
    user.phone = DENALI_OWNER_PHONE;
    user.fullName = "Denali Global Owner";
    user.nationalId = DENALI_OWNER_NATIONAL_ID;
    user.isEmailVerified = true;
    user.isPhoneVerified = true;
    user.hashedPassword = passwordHash;
    user = await userRepo.save(user);
    emitScriptInfo(`Updated owner user id=${user.id}`);
  }
  return user;
}

async function assignOwnerMembership(
  membershipRepo: Repository<UserTenantEntity>,
  tenantId: string,
  userId: string,
): Promise<void> {
  const priorOwners = await membershipRepo.find({
    where: { tenantId, role: UserRole.Owner, deletedAt: IsNull() },
  });
  for (const row of priorOwners) {
    if (row.userId !== userId) {
      row.role = UserRole.Member;
      await membershipRepo.save(row);
    }
  }

  let membership = await membershipRepo.findOne({
    where: { tenantId, userId, deletedAt: IsNull() },
  });
  if (!membership) {
    await membershipRepo.save(
      membershipRepo.create({
        tenantId,
        userId,
        role: UserRole.Owner,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
        sessionVersion: 1,
      }),
    );
    return;
  }
  membership.role = UserRole.Owner;
  membership.status = MembershipStatus.ACTIVE;
  membership.joinedAt = membership.joinedAt ?? new Date();
  membership.suspendedAt = null;
  await membershipRepo.save(membership);
}

async function upsertDenaliThemes(
  themeRepo: Repository<WorkspaceTourThemeEntity>,
  workspaceId: string,
): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const spec of DENALI_THEME_SEEDS) {
    let row = await themeRepo.findOne({
      where: { workspaceId, slug: spec.slug },
    });
    if (!row) {
      row = themeRepo.create({
        workspaceId,
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        sortOrder: spec.sortOrder,
        isActive: true,
        formProfile: spec.formProfile,
      });
    } else {
      row.name = spec.name;
      row.description = spec.description;
      row.sortOrder = spec.sortOrder;
      row.isActive = true;
      row.formProfile = spec.formProfile;
    }
    row = await themeRepo.save(row);
    idBySlug.set(spec.slug, row.id);
  }
  emitScriptInfo(`Upserted ${DENALI_THEME_SEEDS.length} workspace tour themes.`);
  return idBySlug;
}

async function ensureMinimalLocationCatalog(
  dataSource: DataSource,
  tenantId: string,
): Promise<{ regionId: string; destinationId: string } | null> {
  const destRepo = dataSource.getRepository(WorkspaceDestinationEntity);
  const existing = await destRepo.findOne({
    where: { tenantId, isActive: true },
    relations: { region: true },
  });
  if (existing) {
    return { regionId: existing.regionId, destinationId: existing.id };
  }

  const regionRepo = dataSource.getRepository(WorkspaceRegionEntity);
  const region = await regionRepo.save(
    regionRepo.create({
      tenantId,
      name: "Denali — پیش‌فرض",
      country: "IR",
      sortOrder: 0,
      isActive: true,
    }),
  );
  const destination = await destRepo.save(
    destRepo.create({
      tenantId,
      regionId: region.id,
      name: "مقصد پیش‌فرض دنالی",
      type: "شهر",
      sortOrder: 1,
      isActive: true,
    }),
  );
  emitScriptInfo("Inserted minimal region + destination for wizard location step.");
  return { regionId: region.id, destinationId: destination.id };
}

async function seedDenaliPresets(
  dataSource: DataSource,
  workspaceId: string,
  themeIds: Map<string, string>,
): Promise<number> {
  const theme = (slug: string | null): string | null =>
    slug ? (themeIds.get(slug) ?? null) : null;

  const presets: PresetSeed[] = [
    {
      sortOrder: 10,
      name: "دنالی — کوه یک‌روزه",
      description: "پیش‌فرض ویزارد برای تور کوهستانی تک‌روزه",
      formProfile: "denali_pilot",
      kind: "mountain_day",
      matchTourType: "mountain",
      themeSlug: "mountain",
    },
    {
      sortOrder: 20,
      name: "دنالی — کوه چندروزه",
      description: "پیش‌فرض ویزارد برای کمپ یا صعود چندروزه",
      formProfile: "denali_pilot",
      kind: "mountain_multi",
      matchTourType: "mountain",
      themeSlug: "mountain",
    },
    {
      sortOrder: 30,
      name: "دنالی — طبیعت یک‌روزه",
      description: "گشت یا پیمایش طبیعت تک‌روزه",
      formProfile: "denali_pilot",
      kind: "nature_day",
      matchTourType: "nature",
      themeSlug: "nature",
    },
    {
      sortOrder: 40,
      name: "دنالی — طبیعت چندروزه",
      description: "سفر طبیعت چندروزه",
      formProfile: "denali_pilot",
      kind: "nature_multi",
      matchTourType: "nature",
      themeSlug: "nature",
    },
    {
      sortOrder: 50,
      name: "دنالی — جلسه ۱ ساعت",
      description: "کتاب‌خوانی / فیلم ~۱ ساعت",
      formProfile: "denali_pilot",
      kind: "event_reading",
      matchTourType: null,
      themeSlug: "nature",
    },
    {
      sortOrder: 60,
      name: "دنالی — جلسه ۲ ساعت",
      description: "کارگاه یا نمایش ~۲ ساعت",
      formProfile: "denali_pilot",
      kind: "event_cinema",
      matchTourType: null,
      themeSlug: "nature",
    },
  ];

  await dataSource.query(
    `DELETE FROM workspace_tour_creation_presets
     WHERE workspace_id = $1 AND (name LIKE 'دنالی —%' OR name LIKE 'دنالی-%')`,
    [workspaceId],
  );

  for (const row of presets) {
    const mainThemeId = theme(row.themeSlug);
    if (!mainThemeId) {
      fail(`seedDenaliPresets: theme slug "${row.themeSlug}" not found`);
    }
    const defaultsMerged = buildDenaliPresetDefaults(row.kind, mainThemeId);
    await dataSource.query(
      `INSERT INTO workspace_tour_creation_presets
        (workspace_id, name, description, is_active, sort_order, match_tour_type, match_main_tour_theme_id, form_profile, defaults)
       VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8::jsonb)`,
      [
        workspaceId,
        row.name,
        row.description,
        row.sortOrder,
        row.matchTourType,
        mainThemeId,
        row.formProfile,
        JSON.stringify(defaultsMerged),
      ],
    );
  }
  emitScriptInfo(`Inserted ${presets.length} tour creation presets.`);
  return presets.length;
}

export type DenaliProvisionSummary = {
  tenantId: string;
  subdomain: string;
  ownerUserId: string;
  ownerRequestedId: string;
  themeCount: number;
  presetCount: number;
  profileAliases: typeof DENALI_PROFILE_ALIASES;
  wizardUrl: string;
};

export async function provisionDenaliTenant(): Promise<DenaliProvisionSummary> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DENALI_PROVISION !== "true") {
    fail(
      "provision-denali-tenant: refusing production. Set ALLOW_DENALI_PROVISION=true after explicit review.",
    );
  }

  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [
      TenantEntity,
      UserEntity,
      UserTenantEntity,
      WorkspaceTourThemeEntity,
      WorkspaceRegionEntity,
      WorkspaceDestinationEntity,
    ],
  });

  await dataSource.initialize();
  try {
    const tenant = await upsertTenant(dataSource.getRepository(TenantEntity));
    const passwordHash = await argon2.hash(DENALI_OWNER_PASSWORD);
    const owner = await upsertOwnerUser(dataSource.getRepository(UserEntity), passwordHash);
    await assignOwnerMembership(
      dataSource.getRepository(UserTenantEntity),
      tenant.id,
      owner.id,
    );

    const themeIds = await upsertDenaliThemes(
      dataSource.getRepository(WorkspaceTourThemeEntity),
      tenant.id,
    );
    await ensureMinimalLocationCatalog(dataSource, tenant.id);
    const presetCount = await seedDenaliPresets(dataSource, tenant.id, themeIds);
    await upsertWorkspaceWizardTemplate(dataSource, tenant.id, { baseProfile: "denali_pilot" });

    const summary: DenaliProvisionSummary = {
      tenantId: tenant.id,
      subdomain: tenant.subdomain ?? DENALI_SUBDOMAIN,
      ownerUserId: owner.id,
      ownerRequestedId: DENALI_OWNER_REQUESTED_ID,
      themeCount: DENALI_THEME_SEEDS.length,
      presetCount,
      profileAliases: DENALI_PROFILE_ALIASES,
      wizardUrl: `https://${DENALI_SUBDOMAIN}.<your-host>/tours/new`,
    };

    emitScriptInfo("=== Denali provision complete ===");
    emitScriptInfo(JSON.stringify(summary, null, 2));
    emitScriptInfo(`Owner login: ${DENALI_OWNER_EMAIL} / ${DENALI_OWNER_PASSWORD} (or OTP if configured for ${DENALI_OWNER_PHONE})`);
    emitScriptInfo(
      "Wizard profile: denali_pilot (themes + presets); legacy aliases in DENALI_PROFILE_ALIASES for docs only.",
    );
    return summary;
  } finally {
    await dataSource.destroy();
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" && process.argv[1].includes("provision-denali-tenant");

if (isDirectRun) {
  provisionDenaliTenant().catch((error: unknown) => {
    console.error(
      "provision-denali-tenant failed:",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
