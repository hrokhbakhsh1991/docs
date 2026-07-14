import { BANNER } from "../constants.mjs";
import {
  normalizeMemberPortalAvailability,
  resolveEffectiveMemberPortalConfig,
} from "./member-portal.mjs";

const CATALOG_LIST_ROUTE_KEY = /^GET \/[^/]+\/catalog$/;
const CATALOG_DETAIL_ROUTE_KEY = /^GET \/[^/]+\/catalog\/:tourId$/;

function parseGetRoutePath(routeKey) {
  const spaceIndex = routeKey.indexOf(" ");
  if (spaceIndex <= 0) {
    throw new Error(`Invalid HTTP route key "${routeKey}" — expected "METHOD /path"`);
  }
  const method = routeKey.slice(0, spaceIndex);
  if (method !== "GET") {
    return null;
  }
  return routeKey.slice(spaceIndex + 1);
}

/**
 * Extract guest catalog list path from manifest httpRoutes (PF-0.1).
 * @param {Record<string, unknown>} manifest
 * @returns {{ readonly pluginId: string, readonly listPath: string } | null}
 */
export function extractCatalogPathsFromManifest(manifest) {
  const httpRoutes = manifest.httpRoutes;
  if (httpRoutes === undefined || !Array.isArray(httpRoutes.groups)) {
    return null;
  }

  let listPath = null;

  for (let groupIndex = 0; groupIndex < httpRoutes.groups.length; groupIndex += 1) {
    const group = httpRoutes.groups[groupIndex];
    const staticHandlers = group.staticHandlers ?? {};
    for (const routeKey of Object.keys(staticHandlers)) {
      if (!CATALOG_LIST_ROUTE_KEY.test(routeKey)) {
        continue;
      }
      const path = parseGetRoutePath(routeKey);
      if (path === null) {
        continue;
      }
      if (listPath !== null && listPath !== path) {
        throw new Error(
          `${manifest.id}: ambiguous catalog list route in httpRoutes.groups[${groupIndex}]`
        );
      }
      listPath = path;
    }

    const paramHandlers = group.paramHandlers ?? {};
    for (const routeKey of Object.keys(paramHandlers)) {
      if (!CATALOG_DETAIL_ROUTE_KEY.test(routeKey)) {
        continue;
      }
      const path = parseGetRoutePath(routeKey);
      if (path === null) {
        continue;
      }
      const basePath = path.replace(/\/:tourId$/, "");
      if (listPath !== null && listPath !== basePath) {
        throw new Error(
          `${manifest.id}: catalog list/detail path mismatch in httpRoutes.groups[${groupIndex}]`
        );
      }
      listPath = basePath;
    }
  }

  if (listPath === null) {
    return null;
  }

  return Object.freeze({
    pluginId: manifest.id,
    listPath,
  });
}

export function generateWorkspaceCatalogPaths(manifests) {
  /** @type {Record<string, string>} */
  const listPaths = {};
  for (const manifest of manifests) {
    const extracted = extractCatalogPathsFromManifest(manifest);
    if (manifest.guestCatalog?.enabled === true && extracted === null) {
      throw new Error(`${manifest.id}: guestCatalog.enabled requires catalog httpRoutes`);
    }
    if (extracted === null) {
      continue;
    }
    if (manifest.guestCatalog?.enabled === true && extracted.listPath.length === 0) {
      throw new Error(`${manifest.id}: guestCatalog.enabled requires catalog httpRoutes`);
    }
    listPaths[extracted.pluginId] = extracted.listPath;
  }

  const entries = Object.entries(listPaths)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pluginId, listPath]) => `  ${JSON.stringify(pluginId)}: ${JSON.stringify(listPath)},`)
    .join("\n");

  return `${BANNER}
/** Guest catalog list paths — derived from workspace.manifest.json httpRoutes. */
export const WORKSPACE_CATALOG_LIST_PATHS: Readonly<Record<string, string>> = Object.freeze({
${entries}
});
`;
}

export function generateWorkspaceGuestConformance(manifests) {
  const entries = manifests
    .map((manifest) => {
      const level = resolveGuestConformanceLevel(manifest);
      return `  ${JSON.stringify(manifest.id)}: ${JSON.stringify(level)},`;
    })
    .join("\n");

  return `${BANNER}
/** Guest surface conformance level (PF-0.5 stub — manifest-derived only). */
export const WORKSPACE_GUEST_CONFORMANCE_LEVELS: Readonly<
  Record<string, "L0" | "L1" | "L2" | "L3" | "L4">
> = Object.freeze({
${entries}
});

export type WorkspaceGuestConformanceLevel = "L0" | "L1" | "L2" | "L3" | "L4";
`;
}

/** @param {ReturnType<typeof discoverManifests>[number]} manifest */
export function resolveProductionCertificationTier(manifest) {
  const raw = manifest.guestConformance?.productionTier;
  if (raw === undefined) {
    return "stub";
  }
  if (raw !== "stub" && raw !== "certified") {
    throw new Error(
      `${manifest.id}: guestConformance.productionTier must be "stub" or "certified"`
    );
  }
  if (manifest.id === "starter" && raw === "certified") {
    throw new Error(`${manifest.id}: WORKSPACE_STARTER_NOT_CERTIFIABLE`);
  }
  if (raw === "certified") {
    const level = resolveGuestConformanceLevel(manifest);
    if (level === "L0" || level === "L1" || level === "L2") {
      throw new Error(`${manifest.id}: WORKSPACE_CERTIFICATION_L3_REQUIRED`);
    }
    if (manifest.guestConformance?.memberApp === true && level !== "L4") {
      throw new Error(`${manifest.id}: WORKSPACE_CERTIFICATION_L4_REQUIRED`);
    }
  }
  return raw;
}

/** @param {ReturnType<typeof discoverManifests>} manifests */
export function generateWorkspaceProductionCertification(manifests) {
  const entries = manifests
    .map((manifest) => {
      const tier = resolveProductionCertificationTier(manifest);
      return `  ${JSON.stringify(manifest.id)}: ${JSON.stringify(tier)},`;
    })
    .join("\n");

  return `${BANNER}
/** Production onboarding tier (Phase H — manifest-derived only). */
export const WORKSPACE_PRODUCTION_CERTIFICATION: Readonly<
  Record<string, "stub" | "certified">
> = Object.freeze({
${entries}
});

export type WorkspaceProductionCertificationTier = "stub" | "certified";
`;
}

/** @param {ReturnType<typeof discoverManifests>[number]} manifest */
export function resolveGuestConformanceLevel(manifest) {
  const hasCatalogRoutes = extractCatalogPathsFromManifest(manifest) !== null;
  const hasRegistrationFlow = manifest.catalogRegistrationFlow !== undefined;
  const hasMemberProfile = manifest.memberProfile !== undefined;
  if (hasCatalogRoutes && hasRegistrationFlow && hasMemberProfile) {
    if (manifest.guestConformance?.memberApp === true) {
      const availability = normalizeMemberPortalAvailability(manifest);
      if (availability === "off") {
        throw new Error(
          `${manifest.id}: guestConformance.memberApp requires memberPortal availability minimal|full`
        );
      }
      return "L4";
    }
    return "L3";
  }
  if (hasCatalogRoutes && hasRegistrationFlow) {
    return "L2";
  }
  if (hasCatalogRoutes) {
    return "L1";
  }
  return "L0";
}

const GUEST_EXTENSION_MANIFEST_KEYS = [
  "guestExtensionsVersion",
  "guestCatalog",
  "guestThemeStylesheets",
  "catalogPresentation",
  "catalogRegistrationFlow",
  "memberProfile",
  "memberPortal",
  "guestCrossSurfaceNav",
  "guestSeo",
  "guestLanding",
  "guestConformance",
  "operatorCapabilities",
  "wizardTemplateEditor",
  "marketingCatalog",
  "settingsDestinationSurface",
  "settingsEquipmentUi",
  "tourActionSubmitCodec",
  "photoUploadErrors",
  "tourListCategoryFilter",
  "operatorUiComponents",
  "wizardDraftUnification",
  "wizardRules",
  "wizardTemplatePreset",
  "wizardDraftShell",
  "wizardCreateChrome",
];

/**
 * PF-1.8 — admission control for guest-facing manifest extensions.
 * This is intentionally local and explicit rather than a runtime dependency on AJV.
 *
 * @param {ReturnType<typeof discoverManifests>[number]} manifest
 */
export function assertGuestExtensionsManifest(manifest) {
  const hasCatalogRoutes = extractCatalogPathsFromManifest(manifest) !== null;
  const hasGuestExtension =
    hasCatalogRoutes ||
    GUEST_EXTENSION_MANIFEST_KEYS.some((key) => manifest[key] !== undefined);

  if (!hasGuestExtension) {
    return;
  }

  if (manifest.guestExtensionsVersion !== 1) {
    throw new Error(`${manifest.id}: guestExtensionsVersion: 1 is required for guest-capable manifests`);
  }

  if (manifest.guestCatalog !== undefined) {
    const guestCatalog = manifest.guestCatalog;
    if (typeof guestCatalog !== "object" || Array.isArray(guestCatalog)) {
      throw new Error(`${manifest.id}: guestCatalog must be an object`);
    }
    if (guestCatalog.enabled !== undefined && typeof guestCatalog.enabled !== "boolean") {
      throw new Error(`${manifest.id}: guestCatalog.enabled must be boolean`);
    }
  }

  if (manifest.guestThemeStylesheets !== undefined) {
    const themes = manifest.guestThemeStylesheets;
    if (typeof themes !== "object" || Array.isArray(themes)) {
      throw new Error(`${manifest.id}: guestThemeStylesheets must be an object`);
    }
    for (const surface of ["portal", "marketing"]) {
      if (themes[surface] === undefined) {
        continue;
      }
      if (
        !Array.isArray(themes[surface]) ||
        themes[surface].some((entry) => typeof entry !== "string" || entry.length === 0)
      ) {
        throw new Error(`${manifest.id}: guestThemeStylesheets.${surface} must be a string array`);
      }
    }
  }

  if (manifest.operatorCapabilities !== undefined) {
    const capabilities = manifest.operatorCapabilities;
    if (typeof capabilities !== "object" || Array.isArray(capabilities)) {
      throw new Error(`${manifest.id}: operatorCapabilities must be an object`);
    }
    for (const key of ["usersDirectory", "reconciliationTriage", "fieldExposureSurfaces"]) {
      if (capabilities[key] !== undefined && typeof capabilities[key] !== "boolean") {
        throw new Error(`${manifest.id}: operatorCapabilities.${key} must be boolean`);
      }
    }
  }

  if (manifest.wizardTemplateEditor !== undefined) {
    const editor = manifest.wizardTemplateEditor;
    if (typeof editor !== "object" || Array.isArray(editor)) {
      throw new Error(`${manifest.id}: wizardTemplateEditor must be an object`);
    }
    if (typeof editor.module !== "string" || editor.module.length === 0) {
      throw new Error(`${manifest.id}: wizardTemplateEditor.module must be a non-empty string`);
    }
    if (typeof editor.export !== "string" || editor.export.length === 0) {
      throw new Error(`${manifest.id}: wizardTemplateEditor.export must be a non-empty string`);
    }
  }

  if (manifest.marketingCatalog !== undefined) {
    const catalog = manifest.marketingCatalog;
    if (typeof catalog !== "object" || Array.isArray(catalog)) {
      throw new Error(`${manifest.id}: marketingCatalog must be an object`);
    }
    if (typeof catalog.module !== "string" || catalog.module.length === 0) {
      throw new Error(`${manifest.id}: marketingCatalog.module must be a non-empty string`);
    }
    if (typeof catalog.export !== "string" || catalog.export.length === 0) {
      throw new Error(`${manifest.id}: marketingCatalog.export must be a non-empty string`);
    }
  }

  if (manifest.wizardTemplateGate !== undefined) {
    const gate = manifest.wizardTemplateGate;
    if (typeof gate !== "object" || Array.isArray(gate)) {
      throw new Error(`${manifest.id}: wizardTemplateGate must be an object`);
    }
    const stepId = gate.defaultPublishedStepId;
    if (typeof stepId !== "string" || stepId.trim().length === 0) {
      throw new Error(
        `${manifest.id}: wizardTemplateGate.defaultPublishedStepId must be a non-empty string`
      );
    }
    if (gate.fieldOverlaysAugment !== undefined) {
      const augment = gate.fieldOverlaysAugment;
      if (typeof augment !== "object" || Array.isArray(augment)) {
        throw new Error(`${manifest.id}: wizardTemplateGate.fieldOverlaysAugment must be an object`);
      }
      if (typeof augment.module !== "string" || augment.module.length === 0) {
        throw new Error(
          `${manifest.id}: wizardTemplateGate.fieldOverlaysAugment.module must be a non-empty string`
        );
      }
      if (typeof augment.export !== "string" || augment.export.length === 0) {
        throw new Error(
          `${manifest.id}: wizardTemplateGate.fieldOverlaysAugment.export must be a non-empty string`
        );
      }
    }
    if (
      gate.preferTemplateDefaultsOnPrefill !== undefined &&
      typeof gate.preferTemplateDefaultsOnPrefill !== "boolean"
    ) {
      throw new Error(
        `${manifest.id}: wizardTemplateGate.preferTemplateDefaultsOnPrefill must be a boolean when set`
      );
    }
    for (const key of Object.keys(gate)) {
      if (
        key !== "defaultPublishedStepId" &&
        key !== "fieldOverlaysAugment" &&
        key !== "preferTemplateDefaultsOnPrefill"
      ) {
        throw new Error(`${manifest.id}: unknown wizardTemplateGate key "${key}"`);
      }
    }
  }

  for (const key of [
    "settingsDestinationSurface",
    "settingsEquipmentUi",
    "tourActionSubmitCodec",
    "photoUploadErrors",
    "tourListCategoryFilter",
    "operatorUiComponents",
    "wizardDraftUnification",
    "wizardRules",
    "wizardTemplatePreset",
    "wizardDraftShell",
    "wizardCreateChrome",
  ]) {
    const block = manifest[key];
    if (block === undefined) {
      continue;
    }
    if (typeof block !== "object" || Array.isArray(block)) {
      throw new Error(`${manifest.id}: ${key} must be an object`);
    }
    if (typeof block.module !== "string" || block.module.length === 0) {
      throw new Error(`${manifest.id}: ${key}.module must be a non-empty string`);
    }
    if (typeof block.export !== "string" || block.export.length === 0) {
      throw new Error(`${manifest.id}: ${key}.export must be a non-empty string`);
    }
  }

  if (manifest.guestConformance !== undefined) {
    const guestConformance = manifest.guestConformance;
    if (typeof guestConformance !== "object" || Array.isArray(guestConformance)) {
      throw new Error(`${manifest.id}: guestConformance must be an object`);
    }
    for (const key of Object.keys(guestConformance)) {
      if (key !== "memberApp" && key !== "productionTier") {
        throw new Error(`${manifest.id}: unknown guestConformance key "${key}"`);
      }
    }
    if (
      guestConformance.memberApp !== undefined &&
      typeof guestConformance.memberApp !== "boolean"
    ) {
      throw new Error(`${manifest.id}: guestConformance.memberApp must be boolean`);
    }
    resolveProductionCertificationTier(manifest);
  }
}

const GCSN_PLATFORM_MOTHER_ONLY_PATHS = new Set(["/about", "/contact", "/pricing"]);
const GCSN_LINK_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;
const GCSN_MAX_LINKS = 8;
const GCSN_WARN_LINKS = 6;
const GCSN_RESERVED_MEMBER_MODULE_IDS = new Set(["more", "api", "catalog"]);
const GCSN_PLATFORM_MEMBER_MODULE_IDS = new Set(["home"]);

/**
 * @param {ReturnType<typeof discoverManifests>[number]} manifest
 */
function listGuestCrossSurfaceMemberModuleIds(manifest) {
  /** @type {Set<string>} */
  const allowed = new Set(GCSN_PLATFORM_MEMBER_MODULE_IDS);
  const config = resolveEffectiveMemberPortalConfig(manifest);
  if (config.availability !== "off") {
    for (const module of config.modules) {
      if (typeof module?.id === "string" && module.id.length > 0) {
        allowed.add(module.id);
      }
    }
  }
  return allowed;
}

/**
 * @param {ReturnType<typeof discoverManifests>[number]} manifest
 */
export function assertGuestCrossSurfaceNavManifest(manifest) {
  const guestCrossSurfaceNav = manifest.guestCrossSurfaceNav;
  if (guestCrossSurfaceNav === undefined) {
    return;
  }
  if (typeof guestCrossSurfaceNav !== "object" || Array.isArray(guestCrossSurfaceNav)) {
    throw new Error(`${manifest.id}: guestCrossSurfaceNav must be an object`);
  }
  if (guestCrossSurfaceNav.version !== 1) {
    throw new Error(`${manifest.id}: guestCrossSurfaceNav.version must be 1`);
  }
  if (!Array.isArray(guestCrossSurfaceNav.links) || guestCrossSurfaceNav.links.length === 0) {
    throw new Error(`${manifest.id}: guestCrossSurfaceNav.links must be a non-empty array`);
  }
  if (guestCrossSurfaceNav.links.length > GCSN_MAX_LINKS) {
    throw new Error(`${manifest.id}: GCSN-LINK-OVERFLOW`);
  }
  if (
    guestCrossSurfaceNav.links.length > GCSN_WARN_LINKS &&
    process.env.WARN_GCSN_LINK_COUNT !== "0"
  ) {
    console.warn(
      `WARN_GCSN_LINK_COUNT:${manifest.id}: guestCrossSurfaceNav.links exceeds ${GCSN_WARN_LINKS}`
    );
  }

  const seenIds = new Set();
  for (const link of guestCrossSurfaceNav.links) {
    if (typeof link?.id !== "string" || !GCSN_LINK_ID_PATTERN.test(link.id)) {
      throw new Error(`${manifest.id}: GCSN-INVALID-ID:${link?.id ?? ""}`);
    }
    if (seenIds.has(link.id)) {
      throw new Error(`${manifest.id}: GCSN-DUP-ID:${link.id}`);
    }
    seenIds.add(link.id);

    if (typeof link.labelKey !== "string" || link.labelKey.length === 0) {
      throw new Error(`${manifest.id}: guestCrossSurfaceNav.links[${link.id}].labelKey is required`);
    }
    if (link.surface !== "marketing" && link.surface !== "portal_egress") {
      throw new Error(`${manifest.id}: GCSN-INVALID-SURFACE:${link.id}`);
    }

    const visibleWhen = link.visibleWhen ?? "club";

    if (link.surface === "marketing") {
      if (typeof link.path !== "string" || !link.path.startsWith("/")) {
        throw new Error(`${manifest.id}: GCSN-INVALID-PATH:${link.id}`);
      }
      if (link.path.startsWith("/me")) {
        throw new Error(`${manifest.id}: GCSN-PORTAL-PATH:${link.id}`);
      }
      if (link.path.includes("://")) {
        throw new Error(`${manifest.id}: GCSN-ABSOLUTE:${link.id}`);
      }
      if (link.egress !== undefined) {
        throw new Error(`${manifest.id}: GCSN-EGRESS-PATH:${link.id}`);
      }
      if (visibleWhen === "club" && GCSN_PLATFORM_MOTHER_ONLY_PATHS.has(link.path)) {
        throw new Error(`${manifest.id}: GCSN-404-RISK:${link.id}:${link.path}`);
      }
    }

    if (link.surface === "portal_egress") {
      if (link.path !== undefined) {
        throw new Error(`${manifest.id}: GCSN-EGRESS-PATH:${link.id}`);
      }
      if (
        link.egress !== "member_module" &&
        link.egress !== "marketing_home" &&
        link.egress !== "marketing_tours"
      ) {
        throw new Error(`${manifest.id}: GCSN-INVALID-EGRESS:${link.id}`);
      }
      if (link.egress === "member_module") {
        if (typeof link.memberModuleId !== "string" || link.memberModuleId.length === 0) {
          throw new Error(`${manifest.id}: GCSN-MISSING-MEMBER-MODULE-ID:${link.id}`);
        }
        if (GCSN_RESERVED_MEMBER_MODULE_IDS.has(link.memberModuleId)) {
          throw new Error(`${manifest.id}: GCSN-RESERVED-MEMBER-MODULE-ID:${link.id}`);
        }
        if (manifest.memberPortal !== undefined) {
          const allowedModuleIds = listGuestCrossSurfaceMemberModuleIds(manifest);
          if (!allowedModuleIds.has(link.memberModuleId)) {
            throw new Error(
              `${manifest.id}: GCSN-UNKNOWN-MEMBER-MODULE-ID:${link.id}:${link.memberModuleId}`
            );
          }
        }
      }
    }

    if (link.memberModuleId !== undefined && link.egress !== "member_module") {
      throw new Error(`${manifest.id}: GCSN-MEMBER-MODULE-ID-EGRESS:${link.id}`);
    }
  }
}

/** @param {ReturnType<typeof discoverManifests>} manifests */
export function generateWorkspaceGuestCrossSurfaceNav(manifests) {
  /** @type {Record<string, string>} */
  const surfaces = {};
  for (const manifest of manifests) {
    assertGuestCrossSurfaceNavManifest(manifest);
    if (manifest.guestCrossSurfaceNav === undefined) {
      continue;
    }
    const nav = manifest.guestCrossSurfaceNav;
    const linkBlocks = nav.links
      .map((link) => {
        const pathEmit =
          link.path === undefined ? "" : `\n        path: ${JSON.stringify(link.path)},`;
        const egressEmit =
          link.egress === undefined ? "" : `\n        egress: ${JSON.stringify(link.egress)},`;
        const memberModuleIdEmit =
          link.memberModuleId === undefined
            ? ""
            : `\n        memberModuleId: ${JSON.stringify(link.memberModuleId)},`;
        const visibleEmit =
          link.visibleWhen === undefined
            ? ""
            : `\n        visibleWhen: ${JSON.stringify(link.visibleWhen)},`;
        return `      Object.freeze({
        id: ${JSON.stringify(link.id)},
        labelKey: ${JSON.stringify(link.labelKey)},
        surface: ${JSON.stringify(link.surface)},${pathEmit}${egressEmit}${memberModuleIdEmit}${visibleEmit}
      }),`;
      })
      .join("\n");

    surfaces[manifest.id] = `  ${JSON.stringify(manifest.id)}: Object.freeze({
    version: 1 as const,
    links: Object.freeze([
${linkBlocks}
    ] as const satisfies readonly GuestCrossSurfaceNavLink[]),
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
import type { GuestCrossSurfaceNavLink, GuestCrossSurfaceNavSurface } from "./guest-cross-surface-nav";

/** Guest cross-surface nav rows — derived from workspace.manifest.json guestCrossSurfaceNav. */
export const WORKSPACE_GUEST_CROSS_SURFACE_NAV: Readonly<
  Record<string, GuestCrossSurfaceNavSurface>
> = Object.freeze({
${entries}
});
`;
}

/**
 * @param {ReturnType<typeof discoverManifests>[number]} manifest
 */
export function assertCatalogPresentationManifest(manifest) {
  const hasCatalogRoutes = extractCatalogPathsFromManifest(manifest) !== null;
  const presentation = manifest.catalogPresentation;
  if (!hasCatalogRoutes) {
    if (presentation !== undefined) {
      throw new Error(`${manifest.id}: catalogPresentation requires catalog httpRoutes`);
    }
    return;
  }
  if (presentation === undefined || typeof presentation !== "object") {
    throw new Error(`${manifest.id}: catalogPresentation is required when catalog httpRoutes exist`);
  }
  const listFeatures = presentation.listFeatures;
  if (listFeatures === undefined || typeof listFeatures.cityFilter !== "boolean") {
    throw new Error(`${manifest.id}: catalogPresentation.listFeatures.cityFilter must be boolean`);
  }
  const serverListFilters = listFeatures.serverListFilters ?? [];
  if (!Array.isArray(serverListFilters)) {
    throw new Error(`${manifest.id}: catalogPresentation.listFeatures.serverListFilters must be an array`);
  }
  const allowedServerListFilters = new Set([
    "q",
    "category",
    "difficulty",
    "fitness",
    "availability",
    "sort",
  ]);
  for (const param of serverListFilters) {
    if (typeof param !== "string" || !allowedServerListFilters.has(param)) {
      throw new Error(
        `${manifest.id}: catalogPresentation.listFeatures.serverListFilters invalid entry: ${String(param)}`
      );
    }
  }
  const detailSections = presentation.detailSections;
  if (detailSections === undefined || typeof detailSections !== "object") {
    throw new Error(`${manifest.id}: catalogPresentation.detailSections is required`);
  }
  for (const key of ["difficulty", "fitness", "itinerary", "policies"]) {
    if (typeof detailSections[key] !== "boolean") {
      throw new Error(`${manifest.id}: catalogPresentation.detailSections.${key} must be boolean`);
    }
  }
  assertGuestLandingManifest(manifest);
}

/**
 * @param {ReturnType<typeof discoverManifests>[number]} manifest
 */
export function assertGuestLandingManifest(manifest) {
  const landing = manifest.guestLanding;
  if (landing === undefined || typeof landing !== "object" || Array.isArray(landing)) {
    throw new Error(`${manifest.id}: guestLanding is required when catalogPresentation exists`);
  }
  const variant = landing.variant;
  if (variant !== "full" && variant !== "minimal") {
    throw new Error(`${manifest.id}: guestLanding.variant must be "full" or "minimal"`);
  }
  const i18nProfile = landing.i18nProfile;
  if (i18nProfile !== "full" && i18nProfile !== "minimal") {
    throw new Error(`${manifest.id}: guestLanding.i18nProfile must be "full" or "minimal"`);
  }
  const sections = landing.sections;
  if (sections === undefined || typeof sections !== "object" || Array.isArray(sections)) {
    throw new Error(`${manifest.id}: guestLanding.sections is required`);
  }
  for (const key of [
    "hero",
    "latestTours",
    "trust",
    "finalCta",
    "faq",
    "footer",
    "whyDenali",
    "journey",
    "testimonials",
    "featuredTours",
    "categories",
    "destinations",
    "heroSearch",
    "gallery",
    "equipment",
    "blogTeaser",
  ]) {
    if (typeof sections[key] !== "boolean") {
      throw new Error(`${manifest.id}: guestLanding.sections.${key} must be boolean`);
    }
  }
  const limit = sections.latestToursLimit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 0 || limit > 12) {
    throw new Error(`${manifest.id}: guestLanding.sections.latestToursLimit must be 0..12`);
  }
  const featuredLimit = sections.featuredToursLimit;
  if (
    typeof featuredLimit !== "number" ||
    !Number.isInteger(featuredLimit) ||
    featuredLimit < 0 ||
    featuredLimit > 12
  ) {
    throw new Error(`${manifest.id}: guestLanding.sections.featuredToursLimit must be 0..12`);
  }
  if (variant === "minimal") {
    if (
      sections.hero ||
      sections.latestTours ||
      sections.trust ||
      sections.finalCta ||
      sections.faq ||
      sections.footer ||
      sections.whyDenali ||
      sections.journey ||
      sections.testimonials ||
      sections.featuredTours ||
      sections.categories ||
      sections.destinations ||
      sections.heroSearch ||
      sections.gallery ||
      sections.equipment ||
      sections.blogTeaser ||
      limit !== 0 ||
      featuredLimit !== 0
    ) {
      throw new Error(`${manifest.id}: guestLanding minimal variant requires all sections false and limit 0`);
    }
    if (i18nProfile !== "minimal") {
      throw new Error(`${manifest.id}: guestLanding minimal variant requires i18nProfile "minimal"`);
    }
  }
  if (variant === "full") {
    if (!sections.hero || !sections.trust || !sections.finalCta) {
      throw new Error(`${manifest.id}: guestLanding full variant requires hero, trust, and finalCta`);
    }
    if (sections.latestTours && limit < 1) {
      throw new Error(`${manifest.id}: guestLanding full variant with latestTours requires limit >= 1`);
    }
    if (sections.featuredTours && featuredLimit < 1) {
      throw new Error(`${manifest.id}: guestLanding full variant with featuredTours requires limit >= 1`);
    }
    if (i18nProfile !== "full") {
      throw new Error(`${manifest.id}: guestLanding full variant requires i18nProfile "full"`);
    }
  }
  if (landing.whySectionAnchor !== undefined) {
    assertGuestLandingContentSlug(
      landing.whySectionAnchor,
      `${manifest.id}: guestLanding.whySectionAnchor`
    );
  }
  if (landing.destinationSlugs !== undefined) {
    if (!Array.isArray(landing.destinationSlugs)) {
      throw new Error(`${manifest.id}: guestLanding.destinationSlugs must be an array`);
    }
    for (const [index, slug] of landing.destinationSlugs.entries()) {
      assertGuestLandingContentSlug(
        slug,
        `${manifest.id}: guestLanding.destinationSlugs[${index}]`
      );
    }
  }
  if (landing.destinationImageStems !== undefined) {
    if (
      typeof landing.destinationImageStems !== "object" ||
      landing.destinationImageStems === null ||
      Array.isArray(landing.destinationImageStems)
    ) {
      throw new Error(`${manifest.id}: guestLanding.destinationImageStems must be an object`);
    }
    const slugs = Array.isArray(landing.destinationSlugs) ? landing.destinationSlugs : [];
    for (const [key, value] of Object.entries(landing.destinationImageStems)) {
      assertGuestLandingContentSlug(
        key,
        `${manifest.id}: guestLanding.destinationImageStems key ${JSON.stringify(key)}`
      );
      assertGuestLandingContentSlug(
        value,
        `${manifest.id}: guestLanding.destinationImageStems.${key}`
      );
      if (slugs.length > 0 && !slugs.includes(key)) {
        throw new Error(
          `${manifest.id}: guestLanding.destinationImageStems.${key} must reference a destinationSlugs entry`
        );
      }
    }
  }
  if (variant === "full" && sections.destinations) {
    const slugs = landing.destinationSlugs ?? [];
    if (!Array.isArray(slugs) || slugs.length === 0) {
      throw new Error(
        `${manifest.id}: guestLanding.destinationSlugs required when sections.destinations is true on full variant`
      );
    }
  }
  if (landing.shellChrome !== undefined) {
    if (
      typeof landing.shellChrome !== "object" ||
      landing.shellChrome === null ||
      Array.isArray(landing.shellChrome)
    ) {
      throw new Error(`${manifest.id}: guestLanding.shellChrome must be an object`);
    }
    if (
      landing.shellChrome.localeSwitcher !== undefined &&
      typeof landing.shellChrome.localeSwitcher !== "boolean"
    ) {
      throw new Error(`${manifest.id}: guestLanding.shellChrome.localeSwitcher must be boolean`);
    }
    if (
      landing.shellChrome.headerToursCta !== undefined &&
      typeof landing.shellChrome.headerToursCta !== "boolean"
    ) {
      throw new Error(`${manifest.id}: guestLanding.shellChrome.headerToursCta must be boolean`);
    }
  }
}

/**
 * @param {unknown} value
 * @param {string} path
 */
function assertGuestLandingContentSlug(value, path) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]*$/.test(value.trim())) {
    throw new Error(`${path} must be a lowercase slug (a-z, 0-9, hyphen)`);
  }
}

/**
 * @param {unknown} value
 * @param {string} path
 */
function assertGuestSeoString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

/**
 * @param {ReturnType<typeof discoverManifests>[number]} manifest
 */
export function assertGuestSeoManifest(manifest) {
  const guestSeo = manifest.guestSeo;
  if (guestSeo === undefined) {
    return;
  }
  if (typeof guestSeo !== "object" || Array.isArray(guestSeo)) {
    throw new Error(`${manifest.id}: guestSeo must be an object`);
  }
  const marketing = guestSeo.marketing;
  if (marketing === undefined || typeof marketing !== "object" || Array.isArray(marketing)) {
    throw new Error(`${manifest.id}: guestSeo.marketing is required`);
  }
  for (const key of ["listTitleKey", "listDescriptionKey", "detailTitleTemplate", "homeTitleKey", "homeDescriptionKey"]) {
    if (marketing[key] !== undefined) {
      assertGuestSeoString(marketing[key], `${manifest.id}: guestSeo.marketing.${key}`);
    }
  }
  const jsonLd = marketing.jsonLd;
  if (jsonLd === undefined || typeof jsonLd !== "object" || Array.isArray(jsonLd)) {
    throw new Error(`${manifest.id}: guestSeo.marketing.jsonLd is required`);
  }
  if (typeof jsonLd.required !== "boolean") {
    throw new Error(`${manifest.id}: guestSeo.marketing.jsonLd.required must be boolean`);
  }
  if (
    !Array.isArray(jsonLd.schemaTypes) ||
    jsonLd.schemaTypes.length === 0 ||
    jsonLd.schemaTypes.some((entry) => typeof entry !== "string" || entry.length === 0)
  ) {
    throw new Error(`${manifest.id}: guestSeo.marketing.jsonLd.schemaTypes must be a non-empty string array`);
  }
  assertGuestSeoString(jsonLd.builderExport, `${manifest.id}: guestSeo.marketing.jsonLd.builderExport`);
  if (jsonLd.richResultsProfile !== undefined) {
    assertGuestSeoString(
      jsonLd.richResultsProfile,
      `${manifest.id}: guestSeo.marketing.jsonLd.richResultsProfile`
    );
  }
  const openGraph = marketing.openGraph;
  if (openGraph !== undefined) {
    if (typeof openGraph !== "object" || Array.isArray(openGraph)) {
      throw new Error(`${manifest.id}: guestSeo.marketing.openGraph must be an object`);
    }
    if (openGraph.type !== undefined) {
      assertGuestSeoString(openGraph.type, `${manifest.id}: guestSeo.marketing.openGraph.type`);
    }
    if (
      openGraph.twitterCard !== undefined &&
      openGraph.twitterCard !== "summary" &&
      openGraph.twitterCard !== "summary_large_image"
    ) {
      throw new Error(
        `${manifest.id}: guestSeo.marketing.openGraph.twitterCard must be summary or summary_large_image`
      );
    }
  }
  const sitemap = marketing.sitemap;
  if (sitemap !== undefined) {
    if (typeof sitemap !== "object" || Array.isArray(sitemap)) {
      throw new Error(`${manifest.id}: guestSeo.marketing.sitemap must be an object`);
    }
    const allowedChangefreq = new Set([
      "always",
      "hourly",
      "daily",
      "weekly",
      "monthly",
      "yearly",
      "never",
    ]);
    if (sitemap.changefreq !== undefined && !allowedChangefreq.has(sitemap.changefreq)) {
      throw new Error(`${manifest.id}: guestSeo.marketing.sitemap.changefreq is invalid`);
    }
    if (
      sitemap.priority !== undefined &&
      (typeof sitemap.priority !== "number" || sitemap.priority < 0 || sitemap.priority > 1)
    ) {
      throw new Error(`${manifest.id}: guestSeo.marketing.sitemap.priority must be between 0 and 1`);
    }
    if (sitemap.includeImages !== undefined && typeof sitemap.includeImages !== "boolean") {
      throw new Error(`${manifest.id}: guestSeo.marketing.sitemap.includeImages must be boolean`);
    }
  }
  const pagination = marketing.pagination;
  if (pagination !== undefined) {
    if (typeof pagination !== "object" || Array.isArray(pagination)) {
      throw new Error(`${manifest.id}: guestSeo.marketing.pagination must be an object`);
    }
    const params = pagination.noindexQueryParams;
    if (
      params !== undefined &&
      (!Array.isArray(params) ||
        params.some((entry) => typeof entry !== "string" || entry.length === 0))
    ) {
      throw new Error(
        `${manifest.id}: guestSeo.marketing.pagination.noindexQueryParams must be a string array`
      );
    }
  }
}

/**
 * @param {Record<string, unknown>} marketing
 */
function serializeGuestSeoMarketingObject(marketing) {
  const lines = [];
  for (const key of ["listTitleKey", "listDescriptionKey", "detailTitleTemplate", "homeTitleKey", "homeDescriptionKey"]) {
    if (marketing[key] !== undefined) {
      lines.push(`      ${key}: ${JSON.stringify(marketing[key])},`);
    }
  }
  const jsonLd = /** @type {Record<string, unknown>} */ (marketing.jsonLd);
  lines.push("      jsonLd: Object.freeze({");
  lines.push(`        required: ${jsonLd.required},`);
  lines.push(
    `        schemaTypes: Object.freeze(${JSON.stringify(jsonLd.schemaTypes)}),`
  );
  lines.push(`        builderExport: ${JSON.stringify(jsonLd.builderExport)},`);
  if (jsonLd.richResultsProfile !== undefined) {
    lines.push(
      `        richResultsProfile: ${JSON.stringify(jsonLd.richResultsProfile)},`
    );
  }
  lines.push("      }),");
  const openGraph = marketing.openGraph;
  if (openGraph !== undefined && typeof openGraph === "object" && !Array.isArray(openGraph)) {
    lines.push("      openGraph: Object.freeze({");
    const og = /** @type {Record<string, unknown>} */ (openGraph);
    if (og.type !== undefined) {
      lines.push(`        type: ${JSON.stringify(og.type)},`);
    }
    if (og.twitterCard !== undefined) {
      lines.push(`        twitterCard: ${JSON.stringify(og.twitterCard)},`);
    }
    lines.push("      }),");
  }
  const sitemap = marketing.sitemap;
  if (sitemap !== undefined && typeof sitemap === "object" && !Array.isArray(sitemap)) {
    lines.push("      sitemap: Object.freeze({");
    const sm = /** @type {Record<string, unknown>} */ (sitemap);
    if (sm.changefreq !== undefined) {
      lines.push(`        changefreq: ${JSON.stringify(sm.changefreq)},`);
    }
    if (sm.priority !== undefined) {
      lines.push(`        priority: ${sm.priority},`);
    }
    if (sm.includeImages !== undefined) {
      lines.push(`        includeImages: ${sm.includeImages},`);
    }
    lines.push("      }),");
  }
  const pagination = marketing.pagination;
  if (pagination !== undefined && typeof pagination === "object" && !Array.isArray(pagination)) {
    const params = /** @type {Record<string, unknown>} */ (pagination).noindexQueryParams;
    if (Array.isArray(params)) {
      lines.push("      pagination: Object.freeze({");
      lines.push(`        noindexQueryParams: Object.freeze(${JSON.stringify(params)}),`);
      lines.push("      }),");
    }
  }
  return lines.join("\n");
}

/** @param {ReturnType<typeof discoverManifests>} manifests */
export function generateWorkspaceGuestSeo(manifests) {
  /** @type {Record<string, object>} */
  const seoByPlugin = {};
  for (const manifest of manifests) {
    assertGuestSeoManifest(manifest);
    if (manifest.guestSeo === undefined) {
      continue;
    }
    seoByPlugin[manifest.id] = Object.freeze({
      marketing: manifest.guestSeo.marketing,
    });
  }

  const entries = Object.entries(seoByPlugin)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pluginId, config]) => {
      const marketing = /** @type {Record<string, unknown>} */ (config.marketing);
      return `  ${JSON.stringify(pluginId)}: Object.freeze({
    marketing: Object.freeze({
${serializeGuestSeoMarketingObject(marketing)}
    }),
  }),`;
    })
    .join("\n");

  return `${BANNER}
export type WorkspaceGuestSeoJsonLd = Readonly<{
  readonly required: boolean;
  readonly schemaTypes: readonly string[];
  readonly builderExport: string;
  readonly richResultsProfile?: string;
}>;

export type WorkspaceGuestSeoMarketing = Readonly<{
  readonly listTitleKey?: string;
  readonly listDescriptionKey?: string;
  readonly detailTitleTemplate?: string;
  readonly homeTitleKey?: string;
  readonly homeDescriptionKey?: string;
  readonly jsonLd: WorkspaceGuestSeoJsonLd;
  readonly openGraph?: Readonly<{
    readonly type?: string;
    readonly twitterCard?: "summary" | "summary_large_image";
  }>;
  readonly sitemap?: Readonly<{
    readonly changefreq?:
      | "always"
      | "hourly"
      | "daily"
      | "weekly"
      | "monthly"
      | "yearly"
      | "never";
    readonly priority?: number;
    readonly includeImages?: boolean;
  }>;
  readonly pagination?: Readonly<{
    readonly noindexQueryParams?: readonly string[];
  }>;
}>;

export type WorkspaceGuestSeoConfig = Readonly<{
  readonly marketing: WorkspaceGuestSeoMarketing;
}>;

/** Guest marketing SEO policy — derived from workspace.manifest.json guestSeo. */
export const WORKSPACE_GUEST_SEO: Readonly<Record<string, WorkspaceGuestSeoConfig>> = Object.freeze({
${entries}
});
`;
}

function normalizeGuestLandingShellChrome(landing) {
  const chrome =
    landing.shellChrome !== undefined &&
    typeof landing.shellChrome === "object" &&
    landing.shellChrome !== null &&
    !Array.isArray(landing.shellChrome)
      ? landing.shellChrome
      : {};
  return {
    localeSwitcher: chrome.localeSwitcher === true,
    headerToursCta: chrome.headerToursCta === true,
  };
}

/** @param {ReturnType<typeof discoverManifests>[number]["guestLanding"]} landing */
function normalizeGuestLandingContent(landing) {
  const whySectionAnchor =
    typeof landing.whySectionAnchor === "string" && landing.whySectionAnchor.trim().length > 0
      ? landing.whySectionAnchor.trim()
      : "why-us";
  const destinationSlugs = Object.freeze(
    (Array.isArray(landing.destinationSlugs) ? landing.destinationSlugs : [])
      .filter((slug) => typeof slug === "string" && slug.trim().length > 0)
      .map((slug) => slug.trim())
  );
  const destinationImageStems = Object.freeze(
    Object.fromEntries(
      Object.entries(
        landing.destinationImageStems !== undefined &&
          typeof landing.destinationImageStems === "object" &&
          landing.destinationImageStems !== null &&
          !Array.isArray(landing.destinationImageStems)
          ? landing.destinationImageStems
          : {}
      )
        .filter(
          ([key, value]) =>
            typeof key === "string" &&
            key.trim().length > 0 &&
            typeof value === "string" &&
            value.trim().length > 0
        )
        .map(([key, value]) => [key.trim(), value.trim()])
    )
  );
  return { whySectionAnchor, destinationSlugs, destinationImageStems };
}

/** @param {ReturnType<typeof discoverManifests>} manifests */
export function generateWorkspaceGuestLanding(manifests) {
  /** @type {Record<string, object>} */
  const landingByPlugin = {};
  for (const manifest of manifests) {
    if (manifest.catalogPresentation === undefined) {
      continue;
    }
    assertGuestLandingManifest(manifest);
    const landing = manifest.guestLanding;
    const content = normalizeGuestLandingContent(landing);
    const shellChrome = normalizeGuestLandingShellChrome(landing);
    landingByPlugin[manifest.id] = Object.freeze({
      variant: landing.variant,
      whySectionAnchor: content.whySectionAnchor,
      destinationSlugs: content.destinationSlugs,
      destinationImageStems: content.destinationImageStems,
      sections: Object.freeze({
        hero: landing.sections.hero,
        latestTours: landing.sections.latestTours,
        latestToursLimit: landing.sections.latestToursLimit,
        trust: landing.sections.trust,
        finalCta: landing.sections.finalCta,
        faq: landing.sections.faq,
        footer: landing.sections.footer,
        whyDenali: landing.sections.whyDenali,
        journey: landing.sections.journey,
        testimonials: landing.sections.testimonials,
        featuredTours: landing.sections.featuredTours,
        featuredToursLimit: landing.sections.featuredToursLimit,
        categories: landing.sections.categories,
        destinations: landing.sections.destinations,
        heroSearch: landing.sections.heroSearch,
        gallery: landing.sections.gallery,
        equipment: landing.sections.equipment,
        blogTeaser: landing.sections.blogTeaser,
      }),
      i18nProfile: landing.i18nProfile,
      shellChrome: Object.freeze({
        localeSwitcher: shellChrome.localeSwitcher,
        headerToursCta: shellChrome.headerToursCta,
      }),
    });
  }

  const entries = Object.entries(landingByPlugin)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([pluginId, value]) =>
        `  ${JSON.stringify(pluginId)}: Object.freeze({
    variant: ${JSON.stringify(value.variant)},
    whySectionAnchor: ${JSON.stringify(value.whySectionAnchor)},
    destinationSlugs: Object.freeze(${JSON.stringify([...value.destinationSlugs])}),
    destinationImageStems: Object.freeze(${JSON.stringify({ ...value.destinationImageStems })}),
    sections: Object.freeze({
      hero: ${value.sections.hero},
      latestTours: ${value.sections.latestTours},
      latestToursLimit: ${value.sections.latestToursLimit},
      trust: ${value.sections.trust},
      finalCta: ${value.sections.finalCta},
      faq: ${value.sections.faq},
      footer: ${value.sections.footer},
      whyDenali: ${value.sections.whyDenali},
      journey: ${value.sections.journey},
      testimonials: ${value.sections.testimonials},
      featuredTours: ${value.sections.featuredTours},
      featuredToursLimit: ${value.sections.featuredToursLimit},
      categories: ${value.sections.categories},
      destinations: ${value.sections.destinations},
      heroSearch: ${value.sections.heroSearch},
      gallery: ${value.sections.gallery},
      equipment: ${value.sections.equipment},
      blogTeaser: ${value.sections.blogTeaser},
    }),
    i18nProfile: ${JSON.stringify(value.i18nProfile)},
    shellChrome: Object.freeze({
      localeSwitcher: ${value.shellChrome.localeSwitcher},
      headerToursCta: ${value.shellChrome.headerToursCta},
    }),
  }),`
    )
    .join("\n");

  return `${BANNER}
export type GuestLandingVariant = "full" | "minimal";

export type GuestLandingFeatures = Readonly<{
  readonly variant: GuestLandingVariant;
  readonly whySectionAnchor: string;
  readonly destinationSlugs: readonly string[];
  readonly destinationImageStems: Readonly<Record<string, string>>;
  readonly sections: Readonly<{
    readonly hero: boolean;
    readonly latestTours: boolean;
    readonly latestToursLimit: number;
    readonly trust: boolean;
    readonly finalCta: boolean;
    readonly faq: boolean;
    readonly footer: boolean;
    readonly whyDenali: boolean;
    readonly journey: boolean;
    readonly testimonials: boolean;
    readonly featuredTours: boolean;
    readonly featuredToursLimit: number;
    readonly categories: boolean;
    readonly destinations: boolean;
    readonly heroSearch: boolean;
    readonly gallery: boolean;
    readonly equipment: boolean;
    readonly blogTeaser: boolean;
  }>;
  readonly i18nProfile: "full" | "minimal";
  readonly shellChrome: Readonly<{
    readonly localeSwitcher: boolean;
    readonly headerToursCta: boolean;
  }>;
}>;

/** Guest marketing landing gates — derived from workspace.manifest.json guestLanding. */
export const WORKSPACE_GUEST_LANDING: Readonly<
  Record<string, GuestLandingFeatures>
> = Object.freeze({
${entries}
});
`;
}

export function generateWorkspaceCatalogListFeatures(manifests) {
  /** @type {Record<string, { cityFilter: boolean; serverListFilters: string[] }>} */
  const features = {};
  for (const manifest of manifests) {
    assertCatalogPresentationManifest(manifest);
    if (manifest.catalogPresentation === undefined) {
      continue;
    }
    features[manifest.id] = Object.freeze({
      cityFilter: manifest.catalogPresentation.listFeatures.cityFilter,
      serverListFilters: Object.freeze(
        [...(manifest.catalogPresentation.listFeatures.serverListFilters ?? [])].sort()
      ),
    });
  }

  const entries = Object.entries(features)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pluginId, value]) => {
      const serverFilters = `[${value.serverListFilters.map((param) => JSON.stringify(param)).join(", ")}]`;
      return `  ${JSON.stringify(pluginId)}: Object.freeze({ cityFilter: ${value.cityFilter}, serverListFilters: Object.freeze(${serverFilters}) }),`;
    })
    .join("\n");

  return `${BANNER}
/** Marketing catalog list features — derived from workspace.manifest.json catalogPresentation. */
export const WORKSPACE_CATALOG_LIST_FEATURES: Readonly<
  Record<
    string,
    Readonly<{ readonly cityFilter: boolean; readonly serverListFilters: readonly string[] }>
  >
> = Object.freeze({
${entries}
});
`;
}

/** @param {ReturnType<typeof discoverManifests>} manifests */
export function generateWorkspaceCatalogDetailSections(manifests) {
  /** @type {Record<string, Record<string, boolean>>} */
  const sections = {};
  for (const manifest of manifests) {
    assertCatalogPresentationManifest(manifest);
    if (manifest.catalogPresentation === undefined) {
      continue;
    }
    const detailSections = manifest.catalogPresentation.detailSections;
    sections[manifest.id] = Object.freeze({
      difficulty: detailSections.difficulty,
      fitness: detailSections.fitness,
      itinerary: detailSections.itinerary,
      policies: detailSections.policies,
    });
  }

  const entries = Object.entries(sections)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pluginId, value]) => {
      return `  ${JSON.stringify(pluginId)}: Object.freeze({
    difficulty: ${value.difficulty},
    fitness: ${value.fitness},
    itinerary: ${value.itinerary},
    policies: ${value.policies},
  }),`;
    })
    .join("\n");

  return `${BANNER}
/** Marketing catalog detail section gates — derived from workspace.manifest.json catalogPresentation. */
export const WORKSPACE_CATALOG_DETAIL_SECTIONS: Readonly<
  Record<
    string,
    Readonly<{
      readonly difficulty: boolean;
      readonly fitness: boolean;
      readonly itinerary: boolean;
      readonly policies: boolean;
    }>
  >
> = Object.freeze({
${entries}
});
`;
}
