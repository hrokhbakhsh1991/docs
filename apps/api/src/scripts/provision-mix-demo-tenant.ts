/**
 * Idempotent provision for **mix-demo** (فاز ۷.۳.۲ — mix themes / profile flip).
 *
 *   pnpm --filter @apps/api provision:tenant -- --slug=mix-demo
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
import { WorkspaceTourThemeEntity } from "../modules/settings-locations/entities/workspace-tour-theme.entity";
import { emitScriptInfo } from "./script-log";
import {
  MIX_DEMO_OWNER_EMAIL,
  MIX_DEMO_OWNER_PASSWORD,
  MIX_DEMO_OWNER_PHONE,
  MIX_DEMO_SUBDOMAIN,
  MIX_DEMO_TENANT_NAME,
  MIX_DEMO_THEME_SEEDS,
} from "./mix-demo-tenant.fixture";
import { ensureWorkspaceLocationCatalog } from "./ensure-workspace-location-catalog";
import { upsertWorkspaceTourThemes } from "./upsert-workspace-tour-themes";
import { upsertWorkspaceWizardTemplate } from "./upsert-workspace-wizard-template";

export type MixDemoProvisionSummary = {
  tenantId: string;
  subdomain: string;
  ownerUserId: string;
  wizardUrl: string;
};

async function upsertTenant(repo: Repository<TenantEntity>): Promise<TenantEntity> {
  const enabledModules = ["form_builder"];
  let tenant = await repo.findOne({
    where: { subdomain: MIX_DEMO_SUBDOMAIN, deletedAt: IsNull() },
  });
  if (!tenant) {
    tenant = await repo.save(
      repo.create({
        name: MIX_DEMO_TENANT_NAME,
        description: "Mixed themes workspace — profile flip when selecting main theme",
        subdomain: MIX_DEMO_SUBDOMAIN,
        enabledModules,
      }),
    );
    emitScriptInfo(`Created tenant ${MIX_DEMO_TENANT_NAME} (${MIX_DEMO_SUBDOMAIN}) id=${tenant.id}`);
  } else {
    tenant.name = MIX_DEMO_TENANT_NAME;
    tenant.enabledModules = enabledModules;
    tenant = await repo.save(tenant);
    emitScriptInfo(`Updated tenant ${MIX_DEMO_TENANT_NAME} id=${tenant.id}`);
  }
  return tenant;
}

async function upsertOwner(
  userRepo: Repository<UserEntity>,
  membershipRepo: Repository<UserTenantEntity>,
  tenantId: string,
): Promise<UserEntity> {
  const hashedPassword = await argon2.hash(MIX_DEMO_OWNER_PASSWORD);
  let user = await userRepo.findOne({
    where: { email: MIX_DEMO_OWNER_EMAIL, deletedAt: IsNull() },
  });
  if (!user) {
    user = await userRepo.save(
      userRepo.create({
        email: MIX_DEMO_OWNER_EMAIL,
        phone: MIX_DEMO_OWNER_PHONE,
        hashedPassword,
        fullName: "Mix Demo Owner",
        isEmailVerified: true,
        isPhoneVerified: true,
      }),
    );
    emitScriptInfo(`Created owner ${MIX_DEMO_OWNER_EMAIL}`);
  } else {
    user.phone = MIX_DEMO_OWNER_PHONE;
    user.hashedPassword = hashedPassword;
    user.isEmailVerified = true;
    user.isPhoneVerified = true;
    user = await userRepo.save(user);
  }

  const existing = await membershipRepo.findOne({
    where: { tenantId, userId: user.id, deletedAt: IsNull() },
  });
  if (existing) {
    existing.role = UserRole.Owner;
    existing.status = MembershipStatus.ACTIVE;
    await membershipRepo.save(existing);
  } else {
    await membershipRepo.save(
      membershipRepo.create({
        tenantId,
        userId: user.id,
        role: UserRole.Owner,
        status: MembershipStatus.ACTIVE,
      }),
    );
  }
  return user;
}

export async function provisionMixDemoTenant(): Promise<MixDemoProvisionSummary> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TENANT_PROVISION !== "true") {
    throw new Error("provision-mix-demo: refusing production. Set ALLOW_TENANT_PROVISION=true.");
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
    await upsertWorkspaceWizardTemplate(dataSource, tenant.id, {
      baseProfile: "general",
      stepOverrides: { skip: [], insert: [] },
    });
    await upsertWorkspaceTourThemes(
      dataSource.getRepository(WorkspaceTourThemeEntity),
      tenant.id,
      MIX_DEMO_THEME_SEEDS,
    );
    await ensureWorkspaceLocationCatalog(dataSource, tenant.id, {
      regionName: "Mix Demo — region",
      destinationName: "Mix Demo — destination",
    });
    const owner = await upsertOwner(
      dataSource.getRepository(UserEntity),
      dataSource.getRepository(UserTenantEntity),
      tenant.id,
    );

    const summary: MixDemoProvisionSummary = {
      tenantId: tenant.id,
      subdomain: MIX_DEMO_SUBDOMAIN,
      ownerUserId: owner.id,
      wizardUrl: `https://${MIX_DEMO_SUBDOMAIN}.<your-host>/tours/new`,
    };
    emitScriptInfo("=== Mix demo provision complete ===");
    emitScriptInfo(JSON.stringify(summary, null, 2));
    emitScriptInfo(`Login OTP phone: ${MIX_DEMO_OWNER_PHONE} (otp 1234 in dev) / email ${MIX_DEMO_OWNER_EMAIL}`);
    return summary;
  } finally {
    await dataSource.destroy();
  }
}
