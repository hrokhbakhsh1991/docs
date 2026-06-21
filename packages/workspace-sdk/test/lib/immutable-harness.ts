import {
  createStarterWorkspacePlugin,
  STARTER_THEME_TOKENS_STYLESHEET,
} from "../../src/reference/starter-plugin-core.js";
import type { WorkspacePlugin } from "../../src/plugin/workspace-plugin.contract.js";
import type { WorkspaceThemeContract } from "../../src/theme/workspace-theme.contract.js";
import {
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceThemePresets,
  type WorkspaceThemePresetId,
} from "../../src/theme/workspace-theme-presets.js";
import type { TenantAuthContext } from "../../src/auth/auth-context.js";
import { defineAbilityFor } from "../../src/auth/casl/index.js";
import { buildTenantAuthz, type TenantAuthz } from "../../src/auth/tenant-authz.js";
import { parseTenantAuthContext } from "../../src/auth/auth-schemas.js";
import type { AppAbility } from "../../src/auth/casl/index.js";

/** Deterministic tenant id for contract tests (no env coupling). */
export const HARNESS_TENANT_A = "harness-tenant-a";
export const HARNESS_TENANT_B = "harness-tenant-b";

export function createHarnessTheme(
  overrides: Partial<WorkspaceThemeContract> = {},
): WorkspaceThemeContract {
  return {
    id: "harness-primary",
    version: 1,
    cssVariables: {
      [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: "var(--color-primary)",
    },
    optionalStylesheet: STARTER_THEME_TOKENS_STYLESHEET,
    ...overrides,
  };
}

/** Fresh starter plugin — no getStarterWorkspacePlugin() singleton (UT-04). */
export function createFreshStarterPlugin(
  theme: WorkspaceThemeContract = workspaceThemePresets["platform-primary"],
): WorkspacePlugin {
  return createStarterWorkspacePlugin(theme);
}

/** JSON round-trip payload for parseWorkspacePluginFromStorage (strips runtime-only functions). */
export function pluginPayloadForStorageIngress(
  plugin: WorkspacePlugin,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(plugin)) as Record<string, unknown>;
}

/** Deep clone of frozen presets — no getWorkspaceThemePresets() singleton (UT-04). */
export function createFreshPresets(): Readonly<
  Record<WorkspaceThemePresetId, WorkspaceThemeContract>
> {
  const clone = structuredClone(workspaceThemePresets) as Record<
    WorkspaceThemePresetId,
    WorkspaceThemeContract
  >;
  for (const preset of Object.values(clone)) {
    Object.freeze(preset.cssVariables);
    Object.freeze(preset);
  }
  return Object.freeze(clone);
}

/** New pure authz instance per call (UT-09). */
export function createFreshAuthz(context: TenantAuthContext): TenantAuthz {
  return buildTenantAuthz(parseTenantAuthContext(context));
}

/** CASL bridge instance per call — use only in auth/casl contract tests. */
export function createFreshAbility(context: TenantAuthContext): AppAbility {
  return defineAbilityFor(parseTenantAuthContext(context));
}

export function harnessMemberContext(
  tenantId: string,
  workspaceId = "ws-harness-1",
): TenantAuthContext {
  return {
    userId: "harness-user",
    tenantId,
    role: "member",
    status: "ACTIVE",
    workspaceId,
  };
}

export function harnessCanonicalDocument(
  data: Record<string, unknown> = {
    basics: { title: "Harness tour" },
    details: { summary: "" },
  },
): {
  schemaVersion: number;
  roots: string[];
  data: Record<string, unknown>;
} {
  const roots = Object.keys(data);
  return {
    schemaVersion: 1,
    roots,
    data,
  };
}
