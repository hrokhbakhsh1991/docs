/**
 * Read-only readiness checks for a workspace tenant by subdomain slug.
 *
 *   pnpm --filter @apps/api verify:tenant -- --slug=denali
 *   TENANT_SLUG=denali pnpm --filter @apps/api verify:tenant
 */
import { DataSource, IsNull } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { UserRole } from "../common/auth/user-role.enum";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";
import {
  DENALI_OWNER_NATIONAL_ID,
  DENALI_OWNER_REQUESTED_ID,
  DENALI_OWNER_USER_ID,
  DENALI_SUBDOMAIN,
  DENALI_THEME_SEEDS,
} from "./denali-tenant.fixture";
import {
  MIX_DEMO_DISTINCT_FORM_PROFILES,
  MIX_DEMO_OWNER_EMAIL,
  MIX_DEMO_SUBDOMAIN,
  MIX_DEMO_THEME_SEEDS,
} from "./mix-demo-tenant.fixture";
import {
  URBAN_DEMO_OWNER_EMAIL,
  URBAN_DEMO_SUBDOMAIN,
  URBAN_DEMO_THEME_SEEDS,
} from "./urban-demo-tenant.fixture";
import { emitScriptInfo } from "./script-log";

export function resolveTenantSlugFromArgv(argv: readonly string[]): string {
  for (const arg of argv) {
    if (arg === "--") {
      continue;
    }
    if (arg.startsWith("--slug=")) {
      const slug = arg.slice("--slug=".length).trim();
      if (slug) {
        return slug;
      }
    }
  }
  const fromEnv = process.env.TENANT_SLUG?.trim();
  return fromEnv || DENALI_SUBDOMAIN;
}

export async function verifyWorkspaceTenant(slug: string): Promise<void> {
  const ds = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [TenantEntity, UserEntity, UserTenantEntity],
  });
  await ds.initialize();
  try {
    const tenant = await ds.getRepository(TenantEntity).findOne({
      where: { subdomain: slug, deletedAt: IsNull() },
    });
    if (!tenant) {
      throw new Error(`Tenant subdomain "${slug}" not found.`);
    }

    const checks: Array<{ ok: boolean; label: string }> = [];
    const modules = new Set(tenant.enabledModules ?? []);
    checks.push({ ok: modules.size > 0, label: "enabled_modules non-empty" });

    const template = await ds.query<Array<{ base_profile: string }>>(
      `SELECT base_profile FROM workspace_tour_wizard_templates WHERE workspace_id = $1 LIMIT 1`,
      [tenant.id],
    );
    checks.push({
      ok: template.length > 0,
      label: "tour wizard template row present",
    });

    if (slug === URBAN_DEMO_SUBDOMAIN) {
      checks.push({ ok: modules.has("form_builder"), label: "enabled_modules includes form_builder" });
      checks.push({ ok: !modules.has("finance"), label: "finance module not required for urban-demo" });

      const baseProfile = template[0]?.base_profile;
      checks.push({
        ok: baseProfile === "urban_event",
        label: "wizard template base_profile = urban_event",
      });

      const themeRows = await ds.query<Array<{ slug: string; form_profile: string; is_active: boolean }>>(
        `SELECT slug, form_profile, is_active FROM workspace_tour_themes
         WHERE workspace_id = $1`,
        [tenant.id],
      );
      const themeBySlug = new Map(themeRows.map((r) => [r.slug, r]));
      for (const spec of URBAN_DEMO_THEME_SEEDS) {
        const row = themeBySlug.get(spec.slug);
        checks.push({
          ok: Boolean(row?.is_active && row.form_profile === spec.formProfile),
          label: `theme ${spec.slug} → ${spec.formProfile}`,
        });
      }

      const ownerUser = await ds.getRepository(UserEntity).findOne({
        where: { email: URBAN_DEMO_OWNER_EMAIL, deletedAt: IsNull() },
      });
      checks.push({ ok: Boolean(ownerUser), label: `owner user ${URBAN_DEMO_OWNER_EMAIL}` });
      if (ownerUser) {
        const ownerMb = await ds.getRepository(UserTenantEntity).findOne({
          where: {
            tenantId: tenant.id,
            userId: ownerUser.id,
            role: UserRole.Owner,
            deletedAt: IsNull(),
          },
        });
        checks.push({ ok: Boolean(ownerMb), label: "owner membership active" });
      }
    } else if (slug === MIX_DEMO_SUBDOMAIN) {
      checks.push({ ok: modules.has("form_builder"), label: "enabled_modules includes form_builder" });
      checks.push({
        ok: template[0]?.base_profile === "general",
        label: "wizard template base_profile = general",
      });

      const themeRows = await ds.query<Array<{ slug: string; form_profile: string; is_active: boolean }>>(
        `SELECT slug, form_profile, is_active FROM workspace_tour_themes WHERE workspace_id = $1`,
        [tenant.id],
      );
      const themeBySlug = new Map(themeRows.map((r) => [r.slug, r]));
      for (const spec of MIX_DEMO_THEME_SEEDS) {
        const row = themeBySlug.get(spec.slug);
        checks.push({
          ok: Boolean(row?.is_active && row.form_profile === spec.formProfile),
          label: `theme ${spec.slug} → ${spec.formProfile}`,
        });
      }
      const activeProfiles = new Set(
        themeRows.filter((r) => r.is_active).map((r) => r.form_profile),
      );
      for (const profile of MIX_DEMO_DISTINCT_FORM_PROFILES) {
        checks.push({
          ok: activeProfiles.has(profile),
          label: `active theme with profile ${profile}`,
        });
      }

      const ownerUser = await ds.getRepository(UserEntity).findOne({
        where: { email: MIX_DEMO_OWNER_EMAIL, deletedAt: IsNull() },
      });
      checks.push({ ok: Boolean(ownerUser), label: `owner user ${MIX_DEMO_OWNER_EMAIL}` });
      if (ownerUser) {
        const ownerMb = await ds.getRepository(UserTenantEntity).findOne({
          where: {
            tenantId: tenant.id,
            userId: ownerUser.id,
            role: UserRole.Owner,
            deletedAt: IsNull(),
          },
        });
        checks.push({ ok: Boolean(ownerMb), label: "owner membership active" });
      }
    } else if (slug === DENALI_SUBDOMAIN) {
      checks.push({ ok: modules.has("form_builder"), label: "enabled_modules includes form_builder" });
      checks.push({ ok: modules.has("finance"), label: "enabled_modules includes finance" });

      const themeRows = await ds.query<Array<{ slug: string; form_profile: string; is_active: boolean }>>(
        `SELECT slug, form_profile, is_active FROM workspace_tour_themes
         WHERE workspace_id = $1 AND slug LIKE 'denali-%'`,
        [tenant.id],
      );
      const themeBySlug = new Map(themeRows.map((r) => [r.slug, r]));
      for (const spec of DENALI_THEME_SEEDS) {
        const row = themeBySlug.get(spec.slug);
        checks.push({
          ok: Boolean(row?.is_active && row.form_profile === spec.formProfile),
          label: `theme ${spec.slug} → ${spec.formProfile}`,
        });
      }

      const presetCount = await ds.query<Array<{ c: string }>>(
        `SELECT count(*)::text AS c FROM workspace_tour_creation_presets
         WHERE workspace_id = $1 AND name LIKE 'دنالی —%' AND is_active = true`,
        [tenant.id],
      );
      checks.push({
        ok: Number(presetCount[0]?.c ?? 0) >= 6,
        label: "≥6 active دنالی- presets",
      });

      const destCount = await ds.query<Array<{ c: string }>>(
        `SELECT count(*)::text AS c FROM workspace_destinations WHERE tenant_id = $1 AND is_active = true`,
        [tenant.id],
      );
      checks.push({
        ok: Number(destCount[0]?.c ?? 0) >= 1,
        label: "≥1 active destination",
      });

      const ownerMb = await ds.getRepository(UserTenantEntity).findOne({
        where: {
          tenantId: tenant.id,
          userId: DENALI_OWNER_USER_ID,
          role: UserRole.Owner,
          deletedAt: IsNull(),
        },
      });
      checks.push({ ok: Boolean(ownerMb), label: `owner membership for ${DENALI_OWNER_USER_ID}` });

      const ownerUser = await ds.query<Array<{ national_id: string | null }>>(
        `SELECT national_id FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [DENALI_OWNER_USER_ID],
      );
      checks.push({
        ok: ownerUser[0]?.national_id === DENALI_OWNER_NATIONAL_ID,
        label: `owner national_id ${DENALI_OWNER_NATIONAL_ID} (requested ${DENALI_OWNER_REQUESTED_ID})`,
      });
    }

    const failed = checks.filter((c) => !c.ok);
    for (const c of checks) {
      emitScriptInfo(`${c.ok ? "✓" : "✗"} ${c.label}`);
    }
    if (failed.length > 0) {
      throw new Error(
        `${failed.length} check(s) failed for "${slug}". Run provision for this workspace.`,
      );
    }
    emitScriptInfo(`${slug} is ready for tour creation at /tours/new`);
  } finally {
    await ds.destroy();
  }
}
