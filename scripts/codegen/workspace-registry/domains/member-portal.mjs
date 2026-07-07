/**
 * Member portal contract SSOT — manifest normalization, validation, codegen.
 * @see docs/phase-19/member-portal-shell/member-portal-registry-schema.mdoc §2
 */
import { BANNER } from "../constants.mjs";

export const MEMBER_PORTAL_NAV_TIERS = new Set(["primary", "secondary", "hidden", "user_menu"]);
export const MEMBER_PORTAL_RESERVED_MODULE_IDS = new Set(["home", "more", "api", "catalog"]);
export const MEMBER_PORTAL_PRIMARY_TIER_CAP = 5;

/** @type {Record<string, { defaultPrimaryModuleId: string; includePlatformHome: boolean; modules: object[] }>} */
export const MEMBER_PORTAL_PRESETS = {
  "guest-minimal-v1": {
    defaultPrimaryModuleId: "trips",
    includePlatformHome: false,
    modules: [
      {
        id: "trips",
        routePath: "/me/registrations",
        nav: { tier: "primary", labelKey: "trips" },
      },
      {
        id: "profile",
        routePath: "/me/profile",
        nav: { tier: "user_menu", labelKey: "profile" },
      },
    ],
  },
  "guest-full-v1": {
    defaultPrimaryModuleId: "trips",
    includePlatformHome: true,
    modules: [
      {
        id: "trips",
        routePath: "/me/registrations",
        nav: { tier: "primary", labelKey: "trips" },
      },
      {
        id: "profile",
        routePath: "/me/profile",
        nav: { tier: "user_menu", labelKey: "profile" },
      },
      {
        id: "wallet",
        routePath: "/me/wallet",
        nav: { tier: "hidden", labelKey: "wallet" },
      },
    ],
  },
};

/**
 * @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>[number]} manifest
 */
export function normalizeMemberPortalAvailability(manifest) {
  const memberPortal = manifest.memberPortal;
  if (memberPortal === undefined) {
    return "off";
  }
  if (typeof memberPortal !== "object" || Array.isArray(memberPortal)) {
    throw new Error(`${manifest.id}: memberPortal must be an object`);
  }
  if (memberPortal.manifestVersion !== 2) {
    throw new Error(
      `${manifest.id}: memberPortal.manifestVersion must be 2 (v1 removed — set availability explicitly)`,
    );
  }
  const availability = memberPortal.availability;
  if (availability === "off" || availability === "minimal" || availability === "full") {
    return availability;
  }
  throw new Error(`${manifest.id}: memberPortal.availability must be off|minimal|full`);
}

/**
 * @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>[number]} manifest
 */
export function resolveEffectiveMemberPortalConfig(manifest) {
  const availability = normalizeMemberPortalAvailability(manifest);
  if (availability === "off") {
    return Object.freeze({ availability: "off" });
  }

  const memberPortal = manifest.memberPortal;
  const presetKey = typeof memberPortal.preset === "string" ? memberPortal.preset : "";
  const preset = presetKey.length > 0 ? MEMBER_PORTAL_PRESETS[presetKey] : undefined;
  if (presetKey.length > 0 && preset === undefined) {
    throw new Error(`${manifest.id}: MEMBER_PORTAL_UNKNOWN_PRESET:${presetKey}`);
  }

  /** @type {Map<string, object>} */
  const modulesById = new Map();
  for (const module of preset?.modules ?? []) {
    modulesById.set(module.id, structuredClone(module));
  }
  if (Array.isArray(memberPortal.modules)) {
    for (const module of memberPortal.modules) {
      modulesById.set(module.id, module);
    }
  }
  const modules = [...modulesById.values()];
  if (modules.length === 0) {
    throw new Error(`${manifest.id}: memberPortal requires preset or modules when availability is ${availability}`);
  }

  const defaultPrimaryModuleId =
    typeof memberPortal.defaultPrimaryModuleId === "string" && memberPortal.defaultPrimaryModuleId.length > 0
      ? memberPortal.defaultPrimaryModuleId
      : preset?.defaultPrimaryModuleId;
  if (typeof defaultPrimaryModuleId !== "string" || defaultPrimaryModuleId.length === 0) {
    throw new Error(`${manifest.id}: memberPortal.defaultPrimaryModuleId is required`);
  }

  const includePlatformHome =
    typeof memberPortal.includePlatformHome === "boolean"
      ? memberPortal.includePlatformHome
      : preset?.includePlatformHome ?? availability === "full";

  return Object.freeze({
    availability,
    defaultPrimaryModuleId,
    includePlatformHome,
    modules,
  });
}

/**
 * @param {object[]} modules
 * @param {string} defaultPrimaryModuleId
 * @param {string} manifestId
 */
function validateMemberPortalModules(modules, defaultPrimaryModuleId, manifestId) {
  const seenIds = new Set();
  let primaryCount = 0;

  for (const module of modules) {
    if (typeof module?.id !== "string" || module.id.length === 0) {
      throw new Error(`${manifestId}: memberPortal.modules[].id is required`);
    }
    if (MEMBER_PORTAL_RESERVED_MODULE_IDS.has(module.id)) {
      throw new Error(`${manifestId}: MEMBER_PORTAL_RESERVED_MODULE_ID:${module.id}`);
    }
    if (seenIds.has(module.id)) {
      throw new Error(`${manifestId}: MEMBER_PORTAL_DUPLICATE_ID:${module.id}`);
    }
    seenIds.add(module.id);

    if (typeof module.routePath !== "string" || !module.routePath.startsWith("/me/")) {
      throw new Error(
        `${manifestId}: MEMBER_PORTAL_INVALID_ROUTE:${module.id}:${module.routePath ?? ""}`
      );
    }

    const nav = module.nav;
    if (typeof nav !== "object" || nav === null) {
      throw new Error(`${manifestId}: memberPortal.modules[${module.id}].nav is required`);
    }
    if (!MEMBER_PORTAL_NAV_TIERS.has(nav.tier)) {
      throw new Error(`${manifestId}: MEMBER_PORTAL_UNKNOWN_NAV_TIER:${nav.tier}`);
    }
    if (nav.tier === "primary") {
      primaryCount += 1;
    }
    if (typeof nav.labelKey !== "string" || nav.labelKey.length === 0) {
      throw new Error(`${manifestId}: memberPortal.modules[${module.id}].nav.labelKey is required`);
    }
  }

  if (primaryCount > MEMBER_PORTAL_PRIMARY_TIER_CAP) {
    throw new Error(`${manifestId}: MEMBER_PORTAL_PRIMARY_OVERFLOW`);
  }
  if (!seenIds.has(defaultPrimaryModuleId)) {
    throw new Error(`${manifestId}: MEMBER_PORTAL_UNKNOWN_DEFAULT:${defaultPrimaryModuleId}`);
  }
}

/**
 * @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>[number]} manifest
 */
export function assertMemberPortalManifest(manifest) {
  const availability = normalizeMemberPortalAvailability(manifest);
  const memberApp = manifest.guestConformance?.memberApp === true;

  if (memberApp && availability === "off") {
    throw new Error(`${manifest.id}: guestConformance.memberApp requires memberPortal availability minimal|full`);
  }
  if (!memberApp && availability !== "off" && manifest.memberPortal?.manifestVersion === 2) {
    // L3 workspaces may ship minimal/full without L4 promotion — allowed.
  }

  if (availability === "off") {
    if (manifest.memberPortal?.preset !== undefined) {
      throw new Error(`${manifest.id}: memberPortal.preset forbidden when availability is off`);
    }
    if (Array.isArray(manifest.memberPortal?.modules) && manifest.memberPortal.modules.length > 0) {
      throw new Error(`${manifest.id}: memberPortal.modules forbidden when availability is off`);
    }
    return;
  }

  const config = resolveEffectiveMemberPortalConfig(manifest);
  validateMemberPortalModules(config.modules, config.defaultPrimaryModuleId, manifest.id);

  if (memberApp && availability !== "full") {
    throw new Error(`${manifest.id}: guestConformance.memberApp requires memberPortal availability full`);
  }
  if (availability === "full" && !memberApp) {
    throw new Error(`${manifest.id}: memberPortal availability full requires guestConformance.memberApp`);
  }
}

/** @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>} manifests */
export function assertMemberPortalL4ReferenceWorkspaces(manifests) {
  for (const manifest of manifests) {
    if (manifest.guestConformance?.memberApp !== true) {
      continue;
    }
    const config = resolveEffectiveMemberPortalConfig(manifest);
    if (config.availability !== "full") {
      throw new Error(`MEMBER_PORTAL_L4_REFERENCE_AVAILABILITY:${manifest.id}`);
    }
  }
}

function renderModuleBlock(module) {
  return `      Object.freeze({
        id: ${JSON.stringify(module.id)},
        routePath: ${JSON.stringify(module.routePath)},
        nav: Object.freeze({
          tier: ${JSON.stringify(module.nav.tier)},
          labelKey: ${JSON.stringify(module.nav.labelKey)},
        }),
      }),`;
}

/** @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>} manifests */
export function generateWorkspaceMemberPortalContracts(manifests) {
  /** @type {Record<string, string>} */
  const rows = {};
  for (const manifest of manifests) {
    assertMemberPortalManifest(manifest);
    const config = resolveEffectiveMemberPortalConfig(manifest);
    if (config.availability === "off") {
      rows[manifest.id] = `  ${JSON.stringify(manifest.id)}: Object.freeze({ availability: "off" as const }),`;
      continue;
    }
    const moduleBlocks = config.modules.map(renderModuleBlock).join("\n");
    rows[manifest.id] = `  ${JSON.stringify(manifest.id)}: Object.freeze({
    availability: ${JSON.stringify(config.availability)},
    includePlatformHome: ${config.includePlatformHome},
    defaultPrimaryModuleId: ${JSON.stringify(config.defaultPrimaryModuleId)},
    modules: Object.freeze([
${moduleBlocks}
    ] as const satisfies readonly MemberModuleManifest[]),
  }),`;
  }

  const entries = Object.entries(rows)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, block]) => block)
    .join("\n");

  return `${BANNER}
import type { MemberModuleManifest } from "./member-module-manifest";
import type { MemberPortalAvailability } from "./member-portal-availability";

export type MemberPortalContractRow =
  | { readonly availability: "off" }
  | {
      readonly availability: Extract<MemberPortalAvailability, "minimal" | "full">;
      readonly includePlatformHome: boolean;
      readonly defaultPrimaryModuleId: string;
      readonly modules: readonly MemberModuleManifest[];
    };

/** SSOT — compiled member portal contract per workspace (manifest → codegen). */
export const WORKSPACE_MEMBER_PORTAL_CONTRACTS: Readonly<
  Record<string, MemberPortalContractRow>
> = Object.freeze({
${entries}
});
`;
}

/** @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>} manifests */
export function generateWorkspaceMemberPortalSurfaces(manifests) {
  /** @type {Record<string, string>} */
  const surfaces = {};
  for (const manifest of manifests) {
    const config = resolveEffectiveMemberPortalConfig(manifest);
    if (config.availability === "off") {
      continue;
    }
    const moduleBlocks = config.modules.map(renderModuleBlock).join("\n");
    surfaces[manifest.id] = `  ${JSON.stringify(manifest.id)}: Object.freeze({
    manifestVersion: 1 as const,
    defaultPrimaryModuleId: ${JSON.stringify(config.defaultPrimaryModuleId)},
    modules: Object.freeze([
${moduleBlocks}
    ] as const satisfies readonly MemberModuleManifest[]),
  }),`;
  }

  const entries =
    Object.keys(surfaces).length === 0
      ? ""
      : Object.entries(surfaces)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, block]) => block)
          .join("\n");

  return `${BANNER}
import type { MemberModuleManifest, MemberPortalSurface } from "./member-module-manifest";

/** Enabled member portal surfaces — subset of WORKSPACE_MEMBER_PORTAL_CONTRACTS. */
export const WORKSPACE_MEMBER_PORTAL_SURFACES: Readonly<
  Record<string, MemberPortalSurface>
> = Object.freeze({
${entries}
});
`;
}
