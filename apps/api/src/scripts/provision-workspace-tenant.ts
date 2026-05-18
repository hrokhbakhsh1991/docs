/**
 * Idempotent provision for a workspace tenant by subdomain slug.
 *
 *   pnpm --filter @apps/api provision:tenant -- --slug=denali
 *   pnpm --filter @apps/api provision:tenant -- --slug=demo --name="Demo Workspace"
 *   pnpm --filter @apps/api provision:tenant -- --slug=demo2 --modules=form_builder --owner-email=o@demo.local --owner-password=demo123
 *   pnpm --filter @apps/api verify:tenant -- --slug=denali
 *
 * `denali` → full Denali catalog; `urban-demo` / `mix-demo` → QA tenants (فاز ۷.۳).
 * Other slugs create a minimal tenant + wizard template row only.
 */
import * as argon2 from "argon2";
import { DataSource, IsNull, Repository } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { UserRole } from "../common/auth/user-role.enum";
import { MembershipStatus } from "../modules/identity/membership-status.enum";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";
import { DENALI_SUBDOMAIN } from "./denali-tenant.fixture";
import { provisionDenaliTenant } from "./provision-denali-tenant";
import { provisionMixDemoTenant } from "./provision-mix-demo-tenant";
import { provisionUrbanDemoTenant } from "./provision-urban-demo-tenant";
import { MIX_DEMO_SUBDOMAIN } from "./mix-demo-tenant.fixture";
import { URBAN_DEMO_SUBDOMAIN } from "./urban-demo-tenant.fixture";
import { emitScriptInfo } from "./script-log";
import { upsertWorkspaceWizardTemplate } from "./upsert-workspace-wizard-template";

function fail(message: string): never {
  console.error(message);
  throw new Error(message);
}

async function upsertMinimalTenant(
  repo: Repository<TenantEntity>,
  slug: string,
  name: string,
  modules: string[],
): Promise<TenantEntity> {
  let tenant = await repo.findOne({ where: { subdomain: slug, deletedAt: IsNull() } });
  if (!tenant) {
    tenant = await repo.save(
      repo.create({
        name,
        description: `Provisioned workspace (${slug})`,
        subdomain: slug,
        enabledModules: modules,
      }),
    );
    emitScriptInfo(`Created tenant ${name} (${slug}) id=${tenant.id}`);
  } else {
    tenant.name = name;
    tenant.enabledModules = modules;
    tenant = await repo.save(tenant);
    emitScriptInfo(`Updated tenant ${name} id=${tenant.id}`);
  }
  return tenant;
}

async function assignOwnerIfProvided(
  userTenantRepo: Repository<UserTenantEntity>,
  tenantId: string,
  owner: UserEntity,
): Promise<void> {
  const existing = await userTenantRepo.findOne({
    where: { tenantId, userId: owner.id, deletedAt: IsNull() },
  });
  if (existing) {
    existing.role = UserRole.Owner;
    existing.status = MembershipStatus.ACTIVE;
    await userTenantRepo.save(existing);
    return;
  }
  await userTenantRepo.save(
    userTenantRepo.create({
      tenantId,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
    }),
  );
}

async function upsertOwnerByEmail(
  userRepo: Repository<UserEntity>,
  email: string,
  password: string,
): Promise<UserEntity> {
  let user = await userRepo.findOne({ where: { email, deletedAt: IsNull() } });
  const hashedPassword = await argon2.hash(password);
  if (!user) {
    user = await userRepo.save(
      userRepo.create({
        email,
        hashedPassword,
        fullName: email.split("@")[0] ?? "Workspace Owner",
        isEmailVerified: true,
        isPhoneVerified: false,
      }),
    );
    emitScriptInfo(`Created owner user ${email}`);
  } else {
    user.hashedPassword = hashedPassword;
    user.isEmailVerified = true;
    user = await userRepo.save(user);
    emitScriptInfo(`Updated owner user ${email}`);
  }
  return user;
}

export type MinimalProvisionSummary = {
  tenantId: string;
  subdomain: string;
  ownerUserId?: string;
  wizardUrl: string;
};

export async function provisionWorkspaceTenant(
  slug: string,
  opts: { name?: string; ownerEmail?: string; ownerPassword?: string; modules?: string[] } = {},
): Promise<MinimalProvisionSummary> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TENANT_PROVISION !== "true") {
    fail("provision-tenant: refusing production. Set ALLOW_TENANT_PROVISION=true.");
  }

  if (slug === DENALI_SUBDOMAIN) {
    const denali = await provisionDenaliTenant();
    return {
      tenantId: denali.tenantId,
      subdomain: denali.subdomain,
      ownerUserId: denali.ownerUserId,
      wizardUrl: denali.wizardUrl,
    };
  }

  if (slug === URBAN_DEMO_SUBDOMAIN) {
    const urban = await provisionUrbanDemoTenant();
    return {
      tenantId: urban.tenantId,
      subdomain: urban.subdomain,
      ownerUserId: urban.ownerUserId,
      wizardUrl: urban.wizardUrl,
    };
  }

  if (slug === MIX_DEMO_SUBDOMAIN) {
    const mix = await provisionMixDemoTenant();
    return {
      tenantId: mix.tenantId,
      subdomain: mix.subdomain,
      ownerUserId: mix.ownerUserId,
      wizardUrl: mix.wizardUrl,
    };
  }

  const modules = opts.modules ?? ["form_builder", "finance"];
  const name = opts.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);

  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [TenantEntity, UserEntity, UserTenantEntity],
  });
  await dataSource.initialize();
  try {
    const tenant = await upsertMinimalTenant(
      dataSource.getRepository(TenantEntity),
      slug,
      name,
      modules,
    );
    await upsertWorkspaceWizardTemplate(dataSource, tenant.id, { baseProfile: "general" });

    let ownerUserId: string | undefined;
    const ownerEmail = opts.ownerEmail?.trim();
    const ownerPassword = opts.ownerPassword?.trim();
    if (ownerEmail && ownerPassword) {
      const owner = await upsertOwnerByEmail(
        dataSource.getRepository(UserEntity),
        ownerEmail,
        ownerPassword,
      );
      await assignOwnerIfProvided(dataSource.getRepository(UserTenantEntity), tenant.id, owner);
      ownerUserId = owner.id;
    }

    const summary: MinimalProvisionSummary = {
      tenantId: tenant.id,
      subdomain: slug,
      ownerUserId,
      wizardUrl: `https://${slug}.<your-host>/tours/new`,
    };
    emitScriptInfo("=== Workspace provision complete ===");
    emitScriptInfo(JSON.stringify(summary, null, 2));
    return summary;
  } finally {
    await dataSource.destroy();
  }
}
