import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

export function generateWizardMediaBindings(manifests) {
  const withWizardMedia = manifests.filter((m) => m.wizardMedia !== undefined);
  if (withWizardMedia.length === 0) {
    return `${BANNER}
export const WORKSPACE_WIZARD_MEDIA_BINDINGS = [] as const;
`;
  }

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of withWizardMedia) {
    const wm = m.wizardMedia;
    const exportNames = [
      wm.workspaceTypeExport,
      wm.maxUploadBytesExport,
      wm.isSessionIdExport,
      wm.isDraftReadKeyAllowedExport,
      wm.putDraftPhotoExport,
      wm.getSignedReadUrlExport,
      wm.ensureBucketExport,
      wm.readConfigExport,
    ];
    if (wm.createPhotoClientExport != null) {
      exportNames.push(wm.createPhotoClientExport);
    }
    importLines.add(`import { ${exportNames.join(", ")} } from "${m.package}";`);
    const bindingProps = [
      `workspaceType: ${wm.workspaceTypeExport}`,
      `maxUploadBytes: ${wm.maxUploadBytesExport}`,
      `isSessionId: ${wm.isSessionIdExport}`,
      `isDraftReadKeyAllowed: ${wm.isDraftReadKeyAllowedExport}`,
      `putDraftPhoto: ${wm.putDraftPhotoExport}`,
      `getSignedReadUrl: ${wm.getSignedReadUrlExport}`,
      `ensurePhotoBucket: ${wm.ensureBucketExport}`,
      `readPhotoConfigFromEnv: ${wm.readConfigExport}`,
    ];
    if (wm.createPhotoClientExport != null) {
      bindingProps.push(`createPhotoClient: ${wm.createPhotoClientExport}`);
    }
    bindingBlocks.push(`  {
    ${bindingProps.join(",\n    ")},
  },`);
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_WIZARD_MEDIA_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;
`;
}

export function generateWizardMediaRouteBindings(manifests) {
  /** @type {string[]} */
  const bffEntries = [];

  for (const m of manifests) {
    const wm = m.wizardMedia;
    if (wm === undefined) continue;
    if (typeof wm.mediaRouteKey !== "string" || wm.mediaRouteKey.trim().length === 0) {
      throw new Error(`${m.id}: wizardMedia.mediaRouteKey is required when wizardMedia is set`);
    }
    const key = wm.mediaRouteKey.trim();
    const bffPath =
      typeof wm.legacyBffPath === "string" && wm.legacyBffPath.trim().length > 0
        ? wm.legacyBffPath.trim()
        : `/api/wizard-media/${encodeURIComponent(key)}`;
    bffEntries.push(`  ${JSON.stringify(key)}: ${JSON.stringify(bffPath)},`);
  }

  return `${BANNER}
/** Manifest-driven mediaRouteKey → web BFF path (legacy alias or neutral). */
export const WIZARD_MEDIA_ROUTE_BFF_PATHS = Object.freeze({
${bffEntries.join("\n")}
}) as Readonly<Record<string, string>>;

export function isKnownWizardMediaRouteBffKey(mediaRouteKey: string): boolean {
  return mediaRouteKey.trim() in WIZARD_MEDIA_ROUTE_BFF_PATHS;
}
`;
}

export function generateWizardMediaBackendRouteBindings(manifests) {
  /** @type {string[]} */
  const backendEntries = [];

  for (const m of manifests) {
    const wm = m.wizardMedia;
    if (wm === undefined) continue;
    if (typeof wm.mediaRouteKey !== "string" || wm.mediaRouteKey.trim().length === 0) {
      throw new Error(`${m.id}: wizardMedia.mediaRouteKey is required when wizardMedia is set`);
    }
    const key = wm.mediaRouteKey.trim();
    const upload =
      typeof wm.legacyBackendUploadPath === "string" ? wm.legacyBackendUploadPath.trim() : "";
    const signedUrl =
      typeof wm.legacyBackendSignedUrlPath === "string"
        ? wm.legacyBackendSignedUrlPath.trim()
        : "";
    if (upload.length === 0 || signedUrl.length === 0) {
      throw new Error(
        `${m.id}: wizardMedia.legacyBackendUploadPath and legacyBackendSignedUrlPath are required when wizardMedia is set`
      );
    }
    backendEntries.push(`  ${JSON.stringify(key)}: Object.freeze({
    upload: ${JSON.stringify(upload)},
    signedUrl: ${JSON.stringify(signedUrl)},
  }),`);
  }

  return `${BANNER}
export type WizardMediaBackendPaths = {
  readonly upload: string;
  readonly signedUrl: string;
};

/** Manifest-driven mediaRouteKey → API backend proxy paths (server-only). */
export const WIZARD_MEDIA_ROUTE_BACKEND_PATHS = Object.freeze({
${backendEntries.join("\n")}
}) as Readonly<Record<string, WizardMediaBackendPaths>>;

export function isKnownWizardMediaRouteBackendKey(mediaRouteKey: string): boolean {
  return mediaRouteKey.trim() in WIZARD_MEDIA_ROUTE_BACKEND_PATHS;
}
`;
}

export function generateWizardSurfaceBindings(manifests) {
  const withSurfaces = manifests.filter((m) => m.wizardSurfaces !== undefined);
  if (withSurfaces.length === 0) {
    return `${BANNER}
import type { WizardCompositeSurface, WizardReviewSurface } from "@/wizard/wizard-surface-types";
import { createPlatformCompositeSurface } from "@/wizard/platform/platform-composite-surface";
import { createPlatformReviewSurface } from "@/wizard/platform/platform-review-surface";

const compositeSurfaceCache = new Map<string, WizardCompositeSurface>([
  ["platform", createPlatformCompositeSurface()],
]);
const reviewSurfaceCache = new Map<string, WizardReviewSurface>([
  ["platform", createPlatformReviewSurface()],
]);

export async function ensureGeneratedCompositeSurface(
  surfaceId: string | undefined
): Promise<WizardCompositeSurface | null> {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return compositeSurfaceCache.get(surfaceId) ?? null;
}

export async function ensureGeneratedReviewSurface(
  surfaceId: string | undefined
): Promise<WizardReviewSurface | null> {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return reviewSurfaceCache.get(surfaceId) ?? null;
}

export function resolveGeneratedCompositeSurface(
  surfaceId: string | undefined
): WizardCompositeSurface | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return compositeSurfaceCache.get(surfaceId) ?? null;
}

export function resolveGeneratedReviewSurface(
  surfaceId: string | undefined
): WizardReviewSurface | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return reviewSurfaceCache.get(surfaceId) ?? null;
}
`;
  }

  /** @type {string[]} */
  const compositeLoaderEntries = [];
  /** @type {string[]} */
  const reviewLoaderEntries = [];

  for (const m of withSurfaces) {
    const ws = m.wizardSurfaces;
    const surfaceId = ws.surfaceId ?? m.id;
    if (ws.composite !== undefined) {
      compositeLoaderEntries.push(`  ${JSON.stringify(surfaceId)}: async () => {
    const mod = await import(${JSON.stringify(ws.composite.webModule)});
    return mod.${ws.composite.export}();
  },`);
    }
    if (ws.review !== undefined) {
      reviewLoaderEntries.push(`  ${JSON.stringify(surfaceId)}: async () => {
    const mod = await import(${JSON.stringify(ws.review.webModule)});
    return mod.${ws.review.export}();
  },`);
    }
  }

  return `${BANNER}
import type { WizardCompositeSurface, WizardReviewSurface } from "@/wizard/wizard-surface-types";
import { createPlatformCompositeSurface } from "@/wizard/platform/platform-composite-surface";
import { createPlatformReviewSurface } from "@/wizard/platform/platform-review-surface";

/** Shell-local platform surfaces — eager (not product workspace packages). */
const compositeSurfaceCache = new Map<string, WizardCompositeSurface>([
  ["platform", createPlatformCompositeSurface()],
]);
const reviewSurfaceCache = new Map<string, WizardReviewSurface>([
  ["platform", createPlatformReviewSurface()],
]);

const COMPOSITE_SURFACE_LOADERS: Readonly<
  Record<string, () => Promise<WizardCompositeSurface>>
> = Object.freeze({
${compositeLoaderEntries.join("\n")}
});

const REVIEW_SURFACE_LOADERS: Readonly<
  Record<string, () => Promise<WizardReviewSurface>>
> = Object.freeze({
${reviewLoaderEntries.join("\n")}
});

/** Warm product composite via dynamic import (no static @app-tour/workspace-* fan-in). */
export async function ensureGeneratedCompositeSurface(
  surfaceId: string | undefined
): Promise<WizardCompositeSurface | null> {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  const cached = compositeSurfaceCache.get(surfaceId);
  if (cached != null) {
    return cached;
  }
  const load = COMPOSITE_SURFACE_LOADERS[surfaceId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  compositeSurfaceCache.set(surfaceId, surface);
  return surface;
}

/** Warm product review via dynamic import (no static @app-tour/workspace-* fan-in). */
export async function ensureGeneratedReviewSurface(
  surfaceId: string | undefined
): Promise<WizardReviewSurface | null> {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  const cached = reviewSurfaceCache.get(surfaceId);
  if (cached != null) {
    return cached;
  }
  const load = REVIEW_SURFACE_LOADERS[surfaceId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  reviewSurfaceCache.set(surfaceId, surface);
  return surface;
}

/** Sync read of warm cache — call ensure* first for product surfaces. */
export function resolveGeneratedCompositeSurface(
  surfaceId: string | undefined
): WizardCompositeSurface | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return compositeSurfaceCache.get(surfaceId) ?? null;
}

export function resolveGeneratedReviewSurface(
  surfaceId: string | undefined
): WizardReviewSurface | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return reviewSurfaceCache.get(surfaceId) ?? null;
}
`;
}

export function generateWizardLabelBindings(manifests) {
  const withI18n = manifests.filter((m) => m.wizardI18n?.labelResolver !== undefined);
  const namespaces = manifests
    .map((m) => m.wizardI18n?.messageNamespace)
    .filter((ns) => typeof ns === "string" && ns.length > 0);

  const uniqueNamespaces = [...new Set(["wizard", ...namespaces])];

  if (withI18n.length === 0) {
    return `${BANNER}
import type { WizardLabelResolver } from "@/wizard/wizard-surface-types";

export const WORKSPACE_WIZARD_I18N_NAMESPACES = ${JSON.stringify(uniqueNamespaces)} as const;

/** Gap Closure B — dynamic-only; sync resolve reads warm cache (null until ensure*). */
export async function ensureGeneratedLabelResolver(
  _surfaceId: string | undefined
): Promise<WizardLabelResolver | null> {
  return null;
}

export function resolveGeneratedLabelResolver(
  _surfaceId: string | undefined
): WizardLabelResolver | null {
  return null;
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];

  for (const m of withI18n) {
    const i18n = m.wizardI18n;
    const surfaceId = m.wizardSurfaces?.surfaceId ?? m.id;
    const lr = i18n.labelResolver;
    loaderEntries.push(`  ${JSON.stringify(surfaceId)}: async () => {
    const mod = await import(${JSON.stringify(lr.webModule)});
    return mod.${lr.export}();
  },`);
  }

  return `${BANNER}
import type { WizardLabelResolver } from "@/wizard/wizard-surface-types";

export const WORKSPACE_WIZARD_I18N_NAMESPACES = ${JSON.stringify(uniqueNamespaces)} as const;

const LABEL_RESOLVER_LOADERS: Readonly<
  Record<string, () => Promise<WizardLabelResolver>>
> = Object.freeze({
${loaderEntries.join("\n")}
});

const labelResolverCache = new Map<string, WizardLabelResolver>();

/** Warm cache via dynamic import (no static product package fan-in). */
export async function ensureGeneratedLabelResolver(
  surfaceId: string | undefined
): Promise<WizardLabelResolver | null> {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  const cached = labelResolverCache.get(surfaceId);
  if (cached != null) {
    return cached;
  }
  const load = LABEL_RESOLVER_LOADERS[surfaceId];
  if (load == null) {
    return null;
  }
  const resolver = await load();
  labelResolverCache.set(surfaceId, resolver);
  return resolver;
}

/** Sync read of warm cache — call ensureGeneratedLabelResolver first for correct labels. */
export function resolveGeneratedLabelResolver(
  surfaceId: string | undefined
): WizardLabelResolver | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return labelResolverCache.get(surfaceId) ?? null;
}
`;
}

export function generateWizardCloneRemintBindings(manifests) {
  const withClone = manifests.filter((m) => m.wizardCloneRemint !== undefined);
  if (withClone.length === 0) {
    return `${BANNER}
export const WORKSPACE_WIZARD_CLONE_REMINT_BINDINGS = [] as const;
`;
  }

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of withClone) {
    const cr = m.wizardCloneRemint;
    const photosExportNames = [
      cr.executeRemintExport,
      cr.assertDestKeyExport,
      cr.readConfigExport,
    ];
    if (cr.executeTourRemintExport != null) {
      photosExportNames.push(cr.executeTourRemintExport);
    }
    const spec = importSpecifier(m.package, cr.module);
    importLines.add(`import { ${cr.workspaceTypeExport} } from "${m.package}";`);
    importLines.add(`import { ${photosExportNames.join(", ")} } from "${spec}";`);
    if (cr.serverRemintModule != null && cr.remintCanonicalExport != null) {
      const serverSpec = importSpecifier(m.package, cr.serverRemintModule);
      importLines.add(`import { ${cr.remintCanonicalExport} } from "${serverSpec}";`);
    }
    const bindingProps = [
      `workspaceType: ${cr.workspaceTypeExport}`,
      `assertDestKey: ${cr.assertDestKeyExport}`,
      `executeRemint: ${cr.executeRemintExport}`,
      `readConfigFromEnv: ${cr.readConfigExport}`,
    ];
    if (cr.remintCanonicalExport != null) {
      bindingProps.push(`remintCanonicalInTour: ${cr.remintCanonicalExport}`);
    }
    if (cr.executeTourRemintExport != null) {
      bindingProps.push(`executeTourRemint: ${cr.executeTourRemintExport}`);
    }
    bindingBlocks.push(`  {
    ${bindingProps.join(",\n    ")},
  },`);
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_WIZARD_CLONE_REMINT_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;
`;
}

export function generateWizardI18nTranslatorHooks(manifests) {
  const namespaces = [
    ...new Set([
      "wizard",
      ...manifests
        .map((m) => m.wizardI18n?.messageNamespace)
        .filter((ns) => typeof ns === "string" && ns.length > 0),
    ]),
  ];

  const hookLines = namespaces.map((ns) => {
    const varName = `t_${ns.replace(/-/g, "_")}`;
    return `  const ${varName} = useTranslations(${JSON.stringify(ns)});`;
  });
  const mapEntries = namespaces.map((ns) => {
    const varName = `t_${ns.replace(/-/g, "_")}`;
    return `      ${JSON.stringify(ns)}: ${varName},`;
  });
  const deps = namespaces.map((ns) => `t_${ns.replace(/-/g, "_")}`).join(", ");

  return `${BANNER}
"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { WORKSPACE_WIZARD_I18N_NAMESPACES } from "./wizard-label-bindings.generated";

/** Codegen hook map — one useTranslations call per WORKSPACE_WIZARD_I18N_NAMESPACES entry. */
export function useGeneratedWorkspaceWizardTranslators() {
${hookLines.join("\n")}
  return useMemo(
    () =>
      ({
${mapEntries.join("\n")}
      }) as const satisfies Partial<
        Record<(typeof WORKSPACE_WIZARD_I18N_NAMESPACES)[number], ReturnType<typeof useTranslations>>
      >,
    [${deps}]
  );
}
`;
}

export function generateWorkspaceWizardMessageLoads(manifests) {
  const withI18n = manifests.filter(
    (m) => typeof m.wizardI18n?.messageNamespace === "string" && m.wizardI18n.messageNamespace !== "wizard"
  );

  const loaderEntries = withI18n.map((m) => {
    const ns = m.wizardI18n.messageNamespace;
    const pkg = m.package;
    return `  ${JSON.stringify(ns)}: {
    fa: () => import(${JSON.stringify(`${pkg}/host/messages/fa/wizard.json`)}),
    en: () => import(${JSON.stringify(`${pkg}/host/messages/en/wizard.json`)}),
  },`;
  });

  return `${BANNER}
type WorkspaceWizardMessageLocale = "fa" | "en";

const WORKSPACE_WIZARD_MESSAGE_LOADERS = {
${loaderEntries.join("\n")}
} as const;

/** Load workspace wizard JSON namespaces for a locale (manifest wizardI18n.messageNamespace). */
export async function loadWorkspaceWizardMessagesForLocale(
  locale: WorkspaceWizardMessageLocale
): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
  Object.entries(WORKSPACE_WIZARD_MESSAGE_LOADERS).map(async ([namespace, loaders]) => {
      const mod = await loaders[locale]();
      return [namespace, mod.default] as const;
    })
  );
  return Object.fromEntries(entries);
}
`;
}

export function generateWizardCreateBindings(manifests) {
  const extendedRows = manifests
    .filter((m) => m.wizardCreate?.extendedChrome === true)
    .map((m) => `  ${JSON.stringify(m.id)},`);

  const brandMarkEntries = manifests
    .filter((m) => typeof m.wizardCreate?.customBrandFallbackMark === "string")
    .map(
      (m) =>
        `  ${JSON.stringify(m.id)}: ${JSON.stringify(m.wizardCreate.customBrandFallbackMark)},`
    );

  return `${BANNER}
/** Plugin ids that use workspace-specific extended create chrome (Phase 14.3). */
export const WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS = new Set<string>([
${extendedRows.join("\n")}
]);

/** Plugin-specific tenant brand fallback marks (manifest wizardCreate.customBrandFallbackMark). */
export const WORKSPACE_WIZARD_CUSTOM_BRAND_FALLBACK_MARKS = Object.freeze({
${brandMarkEntries.join("\n")}
}) as Readonly<Record<string, string>>;
`;
}

/** @param {ReturnType<typeof discoverManifests>} manifests */

export function generateWizardTemplateEditorBindings(manifests) {
  return generatePluginSurfaceBindings(
    manifests,
    "wizardTemplateEditor",
    "@/wizard/wizard-template-editor-types",
    "WizardTemplateEditorSurface",
    "WIZARD_TEMPLATE_EDITORS",
    "resolveWizardTemplateEditor",
    "editor"
  );
}

export function generateMarketingCatalogBindings(manifests) {
  const withCatalog = manifests.filter((m) => m.marketingCatalog !== undefined);
  if (withCatalog.length === 0) {
    return `${BANNER}
import type { MarketingCatalogSurface } from "./marketing-catalog-surface-types";

export function hasMarketingCatalogSurface(_pluginId: string): boolean {
  return false;
}

export async function resolveMarketingCatalogSurface(
  _pluginId: string
): Promise<MarketingCatalogSurface | null> {
  return null;
}
`;
  }

  /** @type {string[]} */
  const idLiterals = [];
  /** @type {string[]} */
  const switchCases = [];

  for (const m of withCatalog) {
    const catalog = m.marketingCatalog;
    if (typeof catalog.module !== "string" || typeof catalog.export !== "string") {
      throw new Error(`${m.id}: marketingCatalog requires module and export`);
    }
    const importFrom = importSpecifier(m.package, catalog.module);
    idLiterals.push(JSON.stringify(m.id));
    switchCases.push(`    case ${JSON.stringify(m.id)}: {
      const mod = await import(${JSON.stringify(importFrom)});
      return mod.${catalog.export};
    }`);
  }

  idLiterals.sort((a, b) => a.localeCompare(b));
  switchCases.sort((a, b) => a.localeCompare(b));

  return `${BANNER}
import type { MarketingCatalogSurface } from "./marketing-catalog-surface-types";

/** Manifest plugin ids with marketingCatalog — sync id check, no product imports. */
const MARKETING_CATALOG_PLUGIN_IDS = new Set<string>([
  ${idLiterals.join(",\n  ")}
]);

export function hasMarketingCatalogSurface(pluginId: string): boolean {
  return MARKETING_CATALOG_PLUGIN_IDS.has(pluginId);
}

/** Lazy product catalog surface — dynamic import only (Wave C.a). */
export async function resolveMarketingCatalogSurface(
  pluginId: string
): Promise<MarketingCatalogSurface | null> {
  switch (pluginId) {
${switchCases.join("\n")}
    default:
      return null;
  }
}
`;
}

/**
 * @param {ReturnType<typeof discoverManifests>} manifests
 * @param {string} manifestKey
 * @param {string} typeImportPath
 * @param {string} typeName
 * @param {string} recordConst
 * @param {string} resolveFn
 * @param {string} aliasPrefix
 */
function generatePluginSurfaceBindings(
  manifests,
  manifestKey,
  typeImportPath,
  typeName,
  recordConst,
  resolveFn,
  aliasPrefix
) {
  const ensureFn = resolveFn.replace(/^resolve/, "ensure");
  const withSurface = manifests.filter((m) => m[manifestKey] !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
import type { ${typeName} } from "${typeImportPath}";

export async function ${ensureFn}(
  _pluginId: string
): Promise<${typeName} | null> {
  return null;
}

export function ${resolveFn}(
  _pluginId: string
): ${typeName} | null {
  return null;
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];

  for (const m of withSurface) {
    const block = m[manifestKey];
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: ${manifestKey} requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export};
  },`);
  }

  return `${BANNER}
import type { ${typeName} } from "${typeImportPath}";

const ${recordConst}_LOADERS: Readonly<
  Record<string, () => Promise<${typeName}>>
> = Object.freeze({
${loaderEntries.join("\n")}
});

const ${recordConst}_CACHE = new Map<string, ${typeName}>();

/** Warm product surface via dynamic import (no static @app-tour/workspace-* fan-in). */
export async function ${ensureFn}(
  pluginId: string
): Promise<${typeName} | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = ${recordConst}_CACHE.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = ${recordConst}_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  ${recordConst}_CACHE.set(pluginId, surface);
  return surface;
}

/** Sync read of warm cache — call ${ensureFn} first for product surfaces. */
export function ${resolveFn}(
  pluginId: string
): ${typeName} | null {
  return ${recordConst}_CACHE.get(pluginId) ?? null;
}
`;
}

export function generateSettingsDestinationBindings(manifests) {
  return generatePluginSurfaceBindings(
    manifests,
    "settingsDestinationSurface",
    "@/features/settings/destination-settings-surface-types",
    "DestinationSettingsSurface",
    "SETTINGS_DESTINATION_SURFACES",
    "resolveSettingsDestinationSurface",
    "destination_surface"
  );
}

export function generateSettingsEquipmentUiBindings(manifests) {
  return generatePluginSurfaceBindings(
    manifests,
    "settingsEquipmentUi",
    "@/features/settings/settings-equipment-ui-types",
    "SettingsEquipmentUiSurface",
    "SETTINGS_EQUIPMENT_UI_SURFACES",
    "resolveSettingsEquipmentUiSurface",
    "equipment_ui"
  );
}

export function generateSettingsExposureSurfacesUiBindings(manifests) {
  return generatePluginSurfaceBindings(
    manifests,
    "settingsExposureSurfacesUi",
    "@/features/settings/settings-exposure-surfaces-ui-types",
    "SettingsExposureSurfacesUiSurface",
    "SETTINGS_EXPOSURE_SURFACES_UI_SURFACES",
    "resolveSettingsExposureSurfacesUiSurface",
    "exposure_surfaces_ui"
  );
}

export function generateTourActionSubmitBindings(manifests) {
  const withCodec = manifests.filter((m) => m.tourActionSubmitCodec !== undefined);
  if (withCodec.length === 0) {
    return `${BANNER}
export type TourActionSubmitErrorPayload = {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly correlationId?: string;
};

export async function ensureTourActionSubmitCodec(
  _pluginId: string
): Promise<null> {
  return null;
}

export async function ensureAllTourActionSubmitCodecs(): Promise<void> {}

export function encodeTourActionSubmitErrorForPlugin(
  _pluginId: string,
  _payload: TourActionSubmitErrorPayload
): string {
  throw new Error("No tour action submit codec registered");
}

export function decodeTourActionSubmitError(
  _raw: string
): TourActionSubmitErrorPayload | null {
  return null;
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];
  /** @type {string[]} */
  const pluginIds = [];

  for (const m of withCodec) {
    const block = m.tourActionSubmitCodec;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: tourActionSubmitCodec requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    pluginIds.push(m.id);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export};
  },`);
  }

  const firstPluginId = JSON.stringify(withCodec[0].id);

  return `${BANNER}
/** Shell-local wire payload — do not import product package types (Gap Closure B.4). */
export type TourActionSubmitErrorPayload = {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly correlationId?: string;
};

type TourActionSubmitCodec = {
  readonly encode: (payload: TourActionSubmitErrorPayload) => string;
  readonly decode: (raw: string) => TourActionSubmitErrorPayload | null;
};

const TOUR_ACTION_SUBMIT_CODECS_LOADERS: Readonly<
  Record<string, () => Promise<TourActionSubmitCodec>>
> = Object.freeze({
${loaderEntries.join("\n")}
});

const TOUR_ACTION_SUBMIT_CODECS_CACHE = new Map<string, TourActionSubmitCodec>();

export async function ensureTourActionSubmitCodec(
  pluginId: string
): Promise<TourActionSubmitCodec | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = TOUR_ACTION_SUBMIT_CODECS_CACHE.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = TOUR_ACTION_SUBMIT_CODECS_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const codec = await load();
  TOUR_ACTION_SUBMIT_CODECS_CACHE.set(pluginId, codec);
  return codec;
}

export async function ensureAllTourActionSubmitCodecs(): Promise<void> {
  await Promise.all(
    ${JSON.stringify(pluginIds)}.map((pluginId) => ensureTourActionSubmitCodec(pluginId))
  );
}

export function encodeTourActionSubmitErrorForPlugin(
  pluginId: string,
  payload: TourActionSubmitErrorPayload
): string {
  const codec = TOUR_ACTION_SUBMIT_CODECS_CACHE.get(pluginId);
  if (codec == null) {
    throw new Error(\`No tour action submit codec for plugin: \${pluginId} (call ensureTourActionSubmitCodec first)\`);
  }
  return codec.encode(payload);
}

export function decodeTourActionSubmitError(
  raw: string
): TourActionSubmitErrorPayload | null {
  for (const codec of TOUR_ACTION_SUBMIT_CODECS_CACHE.values()) {
    const decoded = codec.decode(raw);
    if (decoded != null) {
      return decoded;
    }
  }
  return null;
}

/** @deprecated Use encodeTourActionSubmitErrorForPlugin after ensureTourActionSubmitCodec. */
export function encodeTourActionSubmitError(
  payload: TourActionSubmitErrorPayload
): string {
  return encodeTourActionSubmitErrorForPlugin(${firstPluginId}, payload);
}
`;
}

export function generateTourListCategoryBindings(manifests) {
  return generatePluginSurfaceBindings(
    manifests,
    "tourListCategoryFilter",
    "@/features/tours/tour-list-category-surface-types",
    "TourListCategorySurface",
    "TOUR_LIST_CATEGORY_SURFACES",
    "resolveTourListCategorySurface",
    "tour_list_category"
  );
}

export function generateOperatorUiComponentsBindings(manifests) {
  const withSurface = manifests.filter((m) => m.operatorUiComponents !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
import type { ComponentType } from "react";

export type OperatorUiComponentsSurface = {
  readonly TimeInput: ComponentType<any>;
  readonly DifficultyRangeSlider: ComponentType<any>;
  readonly LocationPickerMap: ComponentType<any>;
  readonly LocationPickerMapInner: ComponentType<any>;
  readonly ensureLeafletDefaultIcon: () => void;
  readonly WizardDatetimePicker: ComponentType<any>;
};

export async function ensureOperatorUiComponentsSurface(
  _pluginId: string
): Promise<OperatorUiComponentsSurface | null> {
  return null;
}

export function resolveOperatorUiComponentsSurface(
  _pluginId: string
): OperatorUiComponentsSurface | null {
  return null;
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];
  for (const m of withSurface) {
    const block = m.operatorUiComponents;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: operatorUiComponents requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export} as OperatorUiComponentsSurface;
  },`);
  }

  return `${BANNER}
import type { ComponentType } from "react";

export type OperatorUiComponentsSurface = {
  readonly TimeInput: ComponentType<any>;
  readonly DifficultyRangeSlider: ComponentType<any>;
  readonly LocationPickerMap: ComponentType<any>;
  readonly LocationPickerMapInner: ComponentType<any>;
  readonly ensureLeafletDefaultIcon: () => void;
  readonly WizardDatetimePicker: ComponentType<any>;
};

const OPERATOR_UI_LOADERS: Readonly<
  Record<string, () => Promise<OperatorUiComponentsSurface>>
> = Object.freeze({
${loaderEntries.join("\n")}
});

const operatorUiCache = new Map<string, OperatorUiComponentsSurface>();

/** Warm operator UI React surface via dynamic import. */
export async function ensureOperatorUiComponentsSurface(
  pluginId: string
): Promise<OperatorUiComponentsSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = operatorUiCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = OPERATOR_UI_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  operatorUiCache.set(pluginId, surface);
  return surface;
}

export function resolveOperatorUiComponentsSurface(
  pluginId: string
): OperatorUiComponentsSurface | null {
  return operatorUiCache.get(pluginId) ?? null;
}

function firstWarmOperatorUiSurface(): OperatorUiComponentsSurface | null {
  for (const surface of operatorUiCache.values()) {
    return surface;
  }
  return null;
}

export function ensureLeafletDefaultIcon(): void {
  const surface = firstWarmOperatorUiSurface();
  if (surface == null) {
    throw new Error("ensureLeafletDefaultIcon: operator UI cache cold (call ensureOperatorUiComponentsSurface first)");
  }
  surface.ensureLeafletDefaultIcon();
}
`;
}

export function generateWizardDraftUnificationBindings(manifests) {
  const withSurface = manifests.filter((m) => m.wizardDraftUnification !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
export async function ensureWizardDraftUnificationSurface(
  _pluginId: string
): Promise<null> {
  return null;
}

export function logWizardDraftTombstoneShadowMismatch(
  _mode: string,
  _baseline: unknown,
  _local: unknown,
  _server: unknown
): void {}

export function resolveWizardDraftCreateTourDraftKey(_pluginId: string): string | null {
  return null;
}

export function readWizardDraftFieldValueFromRegistry(
  _pluginId: string,
  _draft: Record<string, unknown>,
  _canonicalPath: string
): unknown | null {
  return null;
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];
  for (const m of withSurface) {
    const block = m.wizardDraftUnification;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: wizardDraftUnification requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export} as {
      createTourDraftKey: string;
      logTombstoneShadowMismatch: (...args: never[]) => void;
      readDraftFieldValue: (draft: Record<string, unknown>, canonicalPath: string) => unknown;
    };
  },`);
  }

  return `${BANNER}
type WizardDraftUnificationSurface = {
  readonly createTourDraftKey: string;
  readonly logTombstoneShadowMismatch: (
    mode: string,
    baseline: unknown,
    local: unknown,
    server: unknown
  ) => void;
  readonly readDraftFieldValue: (
    draft: Record<string, unknown>,
    canonicalPath: string
  ) => unknown;
};

const DRAFT_UNIFICATION_LOADERS: Readonly<
  Record<
    string,
    () => Promise<{
      createTourDraftKey: string;
      logTombstoneShadowMismatch: (...args: never[]) => void;
      readDraftFieldValue: (draft: Record<string, unknown>, canonicalPath: string) => unknown;
    }>
  >
> = Object.freeze({
${loaderEntries.join("\n")}
});

const draftUnificationCache = new Map<string, WizardDraftUnificationSurface>();

export async function ensureWizardDraftUnificationSurface(
  pluginId: string
): Promise<WizardDraftUnificationSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = draftUnificationCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = DRAFT_UNIFICATION_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  const adapted: WizardDraftUnificationSurface = {
    createTourDraftKey: surface.createTourDraftKey,
    logTombstoneShadowMismatch: (mode, baseline, local, server) => {
      surface.logTombstoneShadowMismatch(
        mode as never,
        baseline as never,
        local as never,
        server as never
      );
    },
    readDraftFieldValue: surface.readDraftFieldValue,
  };
  draftUnificationCache.set(pluginId, adapted);
  return adapted;
}

export function logWizardDraftTombstoneShadowMismatch(
  mode: string,
  baseline: unknown,
  local: unknown,
  server: unknown
): void {
  for (const surface of draftUnificationCache.values()) {
    surface.logTombstoneShadowMismatch(mode, baseline, local, server);
    return;
  }
}

export function resolveWizardDraftCreateTourDraftKey(pluginId: string): string | null {
  return draftUnificationCache.get(pluginId)?.createTourDraftKey ?? null;
}

export function readWizardDraftFieldValueFromRegistry(
  pluginId: string,
  draft: Record<string, unknown>,
  canonicalPath: string
): unknown | null {
  const surface = draftUnificationCache.get(pluginId);
  if (surface == null) {
    return null;
  }
  return surface.readDraftFieldValue(draft, canonicalPath);
}
`;
}

function generateSingleWorkspaceSurfaceBindings(
  manifests,
  manifestKey,
  aliasPrefix,
  surfaceExportName,
  bodyLines
) {
  const withSurface = manifests.filter((m) => m[manifestKey] !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}\n${bodyLines.empty}\n`;
  }
  const m = withSurface[0];
  const block = m[manifestKey];
  if (typeof block.module !== "string" || typeof block.export !== "string") {
    throw new Error(`${m.id}: ${manifestKey} requires module and export`);
  }
  const importFrom = importSpecifier(m.package, block.module);
  const alias = `${aliasPrefix}_${m.id.replace(/-/g, "_")}`;
  return `${BANNER}
import { ${block.export} as ${alias} } from "${importFrom}";
${bodyLines.withSurface(alias, m)}
`;
}

export function generateWizardRulesBindings(manifests) {
  const withSurface = manifests.filter((m) => m.wizardRules !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
export type WizardRulesModule = never;

export function getWizardRulesModuleSync(_pluginId: string): never {
  throw new Error("No wizard rules surface registered");
}

export async function loadWizardRulesModule(_pluginId: string): Promise<never> {
  throw new Error("No wizard rules surface registered");
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];
  for (const m of withSurface) {
    const block = m.wizardRules;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: wizardRules requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    const surface = mod.${block.export};
    return Object.freeze({
      evaluateFormFieldRule: surface.evaluateFormFieldRule,
      applyDenaliInvariantState: surface.applyDenaliInvariantState,
      resolveDenaliRuleSetFromTemplate: surface.resolveDenaliRuleSetFromTemplate,
      buildDefaultForm: surface.buildDenaliTourCreateDefaultValues,
      readCanonicalBasics: surface.readDenaliCanonicalBasics,
      canonicalToFormPathMap: surface.canonicalToFormPathMap,
      tourKindValues: surface.tourKindValues,
    });
  },`);
  }

  return `${BANNER}
export type WizardRulesModule = {
  readonly evaluateFormFieldRule: (...args: never[]) => unknown;
  readonly applyDenaliInvariantState: (...args: never[]) => unknown;
  readonly resolveDenaliRuleSetFromTemplate: (...args: never[]) => unknown;
  readonly buildDefaultForm: (...args: never[]) => unknown;
  readonly readCanonicalBasics: (...args: never[]) => unknown;
  readonly canonicalToFormPathMap: unknown;
  readonly tourKindValues: unknown;
};

const WIZARD_RULES_LOADERS: Readonly<
  Record<string, () => Promise<WizardRulesModule>>
> = Object.freeze({
${loaderEntries.join("\n")}
});

const wizardRulesCache = new Map<string, WizardRulesModule>();

export async function loadWizardRulesModule(pluginId: string): Promise<WizardRulesModule> {
  const cached = wizardRulesCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = WIZARD_RULES_LOADERS[pluginId];
  if (load == null) {
    throw new Error(\`No wizard rules surface for plugin: \${pluginId}\`);
  }
  const module = await load();
  wizardRulesCache.set(pluginId, module);
  return module;
}

/** Sync read of warm cache — call loadWizardRulesModule first. */
export function getWizardRulesModuleSync(pluginId: string): WizardRulesModule {
  const cached = wizardRulesCache.get(pluginId);
  if (cached == null) {
    throw new Error(\`No wizard rules surface for plugin: \${pluginId} (call loadWizardRulesModule first)\`);
  }
  return cached;
}
`;
}

export function generateWizardTemplateGateBindings(manifests) {
  const platformDefault = "basics";
  const entries = manifests.map((m) => {
    const raw = m.wizardTemplateGate?.defaultPublishedStepId;
    const stepId =
      typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : platformDefault;
    return `  ${JSON.stringify(m.id)}: ${JSON.stringify(stepId)},`;
  });

  /** @type {string[]} */
  const loaderEntries = [];
  for (const m of manifests) {
    const augment = m.wizardTemplateGate?.fieldOverlaysAugment;
    if (augment === undefined) {
      continue;
    }
    if (typeof augment.module !== "string" || typeof augment.export !== "string") {
      throw new Error(`${m.id}: wizardTemplateGate.fieldOverlaysAugment requires module and export`);
    }
    const importFrom = importSpecifier(m.package, augment.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${augment.export};
  },`);
  }

  const preferTemplateDefaultsPluginIds = manifests
    .filter((m) => m.wizardTemplateGate?.preferTemplateDefaultsOnPrefill === true)
    .map((m) => m.id);

  return `${BANNER}
type WizardTemplateFieldOverlaysAugment = <
  T extends { readonly canonicalPath: string; readonly hidden?: boolean; readonly defaultValue?: string },
>(
  templateSteps: readonly { readonly enabled?: boolean; readonly fields: readonly T[] }[],
  baseOverlays: ReadonlyMap<string, T>,
) => ReadonlyMap<string, T>;

const FIELD_OVERLAYS_AUGMENT_LOADERS: Readonly<
  Record<string, () => Promise<WizardTemplateFieldOverlaysAugment>>
> = Object.freeze({
${loaderEntries.join("\n")}
});

const fieldOverlaysAugmentCache = new Map<string, WizardTemplateFieldOverlaysAugment>();

export async function ensureWizardTemplateFieldOverlaysAugment(
  pluginId: string
): Promise<WizardTemplateFieldOverlaysAugment | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = fieldOverlaysAugmentCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = FIELD_OVERLAYS_AUGMENT_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const augment = await load();
  fieldOverlaysAugmentCache.set(pluginId, augment);
  return augment;
}

/** Manifest-derived default step id when publishing an empty wizard template. */
export const WORKSPACE_WIZARD_TEMPLATE_GATE_DEFAULT_STEP_ID: Readonly<
  Record<string, string>
> = Object.freeze({
${entries.join("\n")}
});

export function resolveWizardTemplateGateDefaultPublishedStepId(pluginId: string): string {
  return WORKSPACE_WIZARD_TEMPLATE_GATE_DEFAULT_STEP_ID[pluginId] ?? ${JSON.stringify(platformDefault)};
}

/** Manifest-bound workspace augment — uses warm cache (call ensureWizardTemplateFieldOverlaysAugment first). */
export function augmentWizardTemplateFieldOverlays<
  T extends { readonly canonicalPath: string; readonly hidden?: boolean; readonly defaultValue?: string },
>(
  pluginId: string,
  templateSteps: readonly { readonly enabled?: boolean; readonly fields: readonly T[] }[],
  baseOverlays: ReadonlyMap<string, T>,
): ReadonlyMap<string, T> {
  const augment = fieldOverlaysAugmentCache.get(pluginId);
  if (augment == null) {
    return baseOverlays;
  }
  return augment(templateSteps, baseOverlays);
}

const WIZARD_TEMPLATE_PREFER_TEMPLATE_DEFAULTS = new Set<string>(
  ${JSON.stringify(preferTemplateDefaultsPluginIds)},
);

export function resolveWizardTemplatePreferTemplateDefaults(pluginId: string): boolean {
  return WIZARD_TEMPLATE_PREFER_TEMPLATE_DEFAULTS.has(pluginId);
}
`;
}

export function generateWizardTemplatePresetBindings(manifests) {
  const withSurface = manifests.filter((m) => m.wizardTemplatePreset !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
export function loadFullWizardTemplatePreset(_pluginId: string, _seedLabel?: string): Promise<never> {
  return Promise.reject(new Error("No wizard template preset surface registered"));
}
`;
  }

  /** @type {string[]} */
  const cases = [];
  for (const m of withSurface) {
    const block = m.wizardTemplatePreset;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: wizardTemplatePreset requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    cases.push(`  if (pluginId === ${JSON.stringify(m.id)}) {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export}.buildFullTemplatePreset(seedLabel);
  }`);
  }

  return `${BANNER}
export async function loadFullWizardTemplatePreset(
  pluginId: string,
  seedLabel?: string
): Promise<import("@/features/settings/wizard-template-types").WizardTemplatePayload> {
${cases.join("\n")}
  throw new Error(\`No wizard template preset for plugin: \${pluginId}\`);
}
`;
}

export function generateWizardDraftShellBindings(manifests) {
  const withSurface = manifests.filter((m) => m.wizardDraftShell !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
export const DENALI_PLUGIN_ID = "denali";

export type DenaliWizardDraftMeta = {
  readonly currentStepIndex: number;
  readonly wizardSessionId?: string;
  readonly freshStart?: boolean;
  readonly deletedRoots?: readonly string[];
};

export async function ensureWizardDraftShellSurface(_pluginId: string): Promise<null> {
  return null;
}

export function createDenaliWizardDraftSessionId(): string {
  throw new Error("No wizard draft shell surface registered");
}

export function getDenaliWorkspacePluginFromDraftShell(): never {
  throw new Error("No wizard draft shell surface registered");
}

/** Gap Closure B.20 — product-blind aliases for shell facades (token ratchet). */
export const DEFAULT_WIZARD_PLUGIN_ID = DENALI_PLUGIN_ID;
export const createOperatorWizardDraftSessionId = createDenaliWizardDraftSessionId;
export const OPERATOR_CREATE_TOUR_DRAFT_KEY = "denali-create";
export const OPERATOR_WIZARD_DRAFT_NAMESPACE = "operator.wizard";
export const createOperatorDraftSchemaGate = (): never => {
  throw new Error("No wizard draft shell surface registered");
};
export const hydrateOperatorDraftEnvelope = (..._args: any[]): never => {
  throw new Error("No wizard draft shell surface registered");
};
export const prepareOperatorDraftEnvelope = (..._args: any[]): never => {
  throw new Error("No wizard draft shell surface registered");
};
export const isOperatorFreshStartEnvelope = (..._args: any[]): boolean => false;
export const resolveOperatorDraftMerge = (..._args: any[]): never => {
  throw new Error("No wizard draft shell surface registered");
};
export const applyDefaultTourKind = (..._args: any[]): never => {
  throw new Error("No wizard draft shell surface registered");
};
export const buildCreatePrefilledForm = (..._args: any[]): never => {
  throw new Error("No wizard draft shell surface registered");
};
export const getWorkspacePluginFromDraftShell = getDenaliWorkspacePluginFromDraftShell;
export type OperatorWizardDraftMeta = DenaliWizardDraftMeta;
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];
  /** @type {string | null} */
  let firstPluginId = null;
  for (const m of withSurface) {
    if (firstPluginId == null) {
      firstPluginId = m.id;
    }
    const block = m.wizardDraftShell;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: wizardDraftShell requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export};
  },`);
  }

  return `${BANNER}
/** Manifest id literal — no product import required. */
export const DENALI_PLUGIN_ID = ${JSON.stringify(firstPluginId)};

export type DenaliWizardDraftMeta = {
  readonly currentStepIndex: number;
  readonly wizardSessionId?: string;
  /** Set after explicit clear — conflict merge must prefer local template over stale server. */
  readonly freshStart?: boolean;
  /** Server-persisted only — stripped on client hydrate/prepare (Track B). */
  readonly deletedRoots?: readonly string[];
};

type WizardDraftShellSurface = {
  readonly pluginId: string;
  readonly getWorkspacePlugin: () => any;
  readonly createTourDraftKey: string;
  readonly editTourDraftKey: (tourId: string) => string;
  readonly operatorDraftNamespace: string;
  readonly createWizardDraftSessionId: () => string;
  readonly createDraftSchemaGate: (...args: any[]) => any;
  readonly hydrateDraftEnvelope: (...args: any[]) => any;
  readonly prepareDraftEnvelope: (...args: any[]) => any;
  readonly isFreshStartEnvelope: (...args: any[]) => boolean;
  readonly resolveDraftMerge: (...args: any[]) => any;
  readonly emptyTourWizardDraft: (...args: any[]) => any;
  readonly applyDefaultTourKind: (...args: any[]) => any;
  readonly buildCreatePrefilledFormCore: (...args: any[]) => any;
  readonly buildCreatePrefilledForm: (...args: any[]) => any;
};

const WIZARD_DRAFT_SHELL_LOADERS: Readonly<
  Record<string, () => Promise<WizardDraftShellSurface>>
> = Object.freeze({
${loaderEntries.join("\n")}
}) as Readonly<Record<string, () => Promise<WizardDraftShellSurface>>>;

const wizardDraftShellCache = new Map<string, WizardDraftShellSurface>();

/** Warm draft-shell surface via dynamic import (no static product fan-in). */
export async function ensureWizardDraftShellSurface(
  pluginId: string
): Promise<WizardDraftShellSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = wizardDraftShellCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = WIZARD_DRAFT_SHELL_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  wizardDraftShellCache.set(pluginId, surface);
  return surface;
}

function requireWizardDraftShellSurface(pluginId: string = DENALI_PLUGIN_ID): WizardDraftShellSurface {
  const surface = wizardDraftShellCache.get(pluginId);
  if (surface == null) {
    for (const warm of wizardDraftShellCache.values()) {
      return warm;
    }
    throw new Error(
      \`No wizard draft shell for plugin: \${pluginId} (call ensureWizardDraftShellSurface first)\`
    );
  }
  return surface;
}

export function createDenaliWizardDraftSessionId(): string {
  return requireWizardDraftShellSurface().createWizardDraftSessionId();
}

/** Known product draft key literal (matches workspace-denali draft binding SOT). */
export const DENALI_CREATE_TOUR_DRAFT_KEY = "denali-create";

export function denaliEditTourDraftKey(tourId: string): string {
  return requireWizardDraftShellSurface().editTourDraftKey(tourId);
}

/** Known product draft namespace literal (matches workspace-denali draft binding SOT). */
export const DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE = "operator.wizard";

export function createDenaliDraftSchemaGate(...args: any[]): any {
  return requireWizardDraftShellSurface().createDraftSchemaGate(...args);
}

export function denaliHydrateDraftEnvelope(...args: any[]): any {
  return requireWizardDraftShellSurface().hydrateDraftEnvelope(...args);
}

export function denaliPrepareDraftEnvelope(...args: any[]): any {
  return requireWizardDraftShellSurface().prepareDraftEnvelope(...args);
}

export function isDenaliFreshStartEnvelope(...args: any[]): boolean {
  return requireWizardDraftShellSurface().isFreshStartEnvelope(...args);
}

export function resolveDenaliDraftMerge(...args: any[]): any {
  return requireWizardDraftShellSurface().resolveDraftMerge(...args);
}

export function emptyDenaliTourWizardDraft(...args: any[]): any {
  return requireWizardDraftShellSurface().emptyTourWizardDraft(...args);
}

export function applyDenaliDefaultTourKind(...args: any[]): any {
  return requireWizardDraftShellSurface().applyDefaultTourKind(...args);
}

export function buildDenaliCreatePrefilledFormCore(...args: any[]): any {
  return requireWizardDraftShellSurface().buildCreatePrefilledFormCore(...args);
}

export function buildDenaliCreatePrefilledForm(...args: any[]): any {
  return requireWizardDraftShellSurface().buildCreatePrefilledForm(...args);
}

export function getDenaliWorkspacePluginFromDraftShell(): any {
  return requireWizardDraftShellSurface().getWorkspacePlugin();
}

/** Gap Closure B.20 — product-blind aliases for shell facades (token ratchet). */
export const DEFAULT_WIZARD_PLUGIN_ID = DENALI_PLUGIN_ID;
export const createOperatorWizardDraftSessionId = createDenaliWizardDraftSessionId;
export const OPERATOR_CREATE_TOUR_DRAFT_KEY = DENALI_CREATE_TOUR_DRAFT_KEY;
export const OPERATOR_WIZARD_DRAFT_NAMESPACE = DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE;
export const createOperatorDraftSchemaGate = createDenaliDraftSchemaGate;
export const hydrateOperatorDraftEnvelope = denaliHydrateDraftEnvelope;
export const prepareOperatorDraftEnvelope = denaliPrepareDraftEnvelope;
export const isOperatorFreshStartEnvelope = isDenaliFreshStartEnvelope;
export const resolveOperatorDraftMerge = resolveDenaliDraftMerge;
export const applyDefaultTourKind = applyDenaliDefaultTourKind;
export const buildCreatePrefilledForm = buildDenaliCreatePrefilledForm;
export const getWorkspacePluginFromDraftShell = getDenaliWorkspacePluginFromDraftShell;
export type OperatorWizardDraftMeta = DenaliWizardDraftMeta;
`;
}


export function generateWizardCreateChromeBindings(manifests) {
  const withSurface = manifests.filter((m) => m.wizardCreateChrome !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
export type DenaliCreateTourWizardScreen =
  | "gate-loading"
  | "clone-loading"
  | "clone-error"
  | "not-configured"
  | "draft-loading"
  | "ready";

export async function ensureWizardCreateChromeSurface(_pluginId: string): Promise<null> {
  return null;
}

export function useDenaliCreateTourWizardCore(_input: never): never {
  throw new Error("No wizard create chrome surface registered");
}

export function isDraftEssentiallyEmpty(_draft: unknown): boolean {
  return true;
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];
  for (const m of withSurface) {
    const block = m.wizardCreateChrome;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: wizardCreateChrome requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export};
  },`);
  }

  return `${BANNER}
type WizardCreateChromeSurface = {
  readonly useCreateTourWizardCore: (input: never) => unknown;
  readonly isDraftEssentiallyEmpty: (draft: never) => boolean;
};

const WIZARD_CREATE_CHROME_LOADERS: Readonly<
  Record<string, () => Promise<WizardCreateChromeSurface>>
> = Object.freeze({
${loaderEntries.join("\n")}
}) as Readonly<Record<string, () => Promise<WizardCreateChromeSurface>>>;

const wizardCreateChromeCache = new Map<string, WizardCreateChromeSurface>();

/** Warm create-chrome surface (hooks + helpers) via dynamic import. */
export async function ensureWizardCreateChromeSurface(
  pluginId: string
): Promise<WizardCreateChromeSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = wizardCreateChromeCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = WIZARD_CREATE_CHROME_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  wizardCreateChromeCache.set(pluginId, surface);
  return surface;
}

function requireWizardCreateChromeSurface(pluginId: string): WizardCreateChromeSurface {
  const surface = wizardCreateChromeCache.get(pluginId);
  if (surface == null) {
    throw new Error(
      \`No wizard create chrome for plugin: \${pluginId} (call ensureWizardCreateChromeSurface first)\`
    );
  }
  return surface;
}

/**
 * Shell hook wrapper — always invokes product hook after warm (no conditional hook calls).
 * Resolves surface via \`input.session.pluginId\`.
 */
export function useDenaliCreateTourWizardCore(input: {
  readonly session: { readonly pluginId: string };
}): unknown {
  const surface = requireWizardCreateChromeSurface(input.session.pluginId);
  return surface.useCreateTourWizardCore(input as never);
}

export function isDraftEssentiallyEmpty(draft: unknown): boolean {
  for (const surface of wizardCreateChromeCache.values()) {
    return surface.isDraftEssentiallyEmpty(draft as never);
  }
  throw new Error("isDraftEssentiallyEmpty: create chrome cache cold (call ensure first)");
}

/** Shell-local mirror of product create-screen union (avoids type-only product import). */
export type DenaliCreateTourWizardScreen =
  | "gate-loading"
  | "clone-loading"
  | "clone-error"
  | "not-configured"
  | "draft-loading"
  | "ready";

/** Gap Closure B.20 — product-blind aliases for shell facades. */
export const useOperatorCreateTourWizardCore = useDenaliCreateTourWizardCore;
export type OperatorCreateTourWizardScreen = DenaliCreateTourWizardScreen;
`;
}

export function generateWizardFlatEditChromeBindings(manifests) {
  const withSurface = manifests.filter((m) => m.wizardFlatEditChrome !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
export type DenaliFlatEditTourDetail = {
  readonly projection: {
    readonly title: string;
    readonly uiStatus: string;
    readonly priceAmount: number | null;
    readonly priceCurrency: string | null;
    readonly departureAt: string | null;
    readonly acceptedSeats: number;
    readonly capacity: number | null;
  };
};

export type DenaliFlatEditTourLoadResult =
  | {
      readonly ok: true;
      readonly detail: DenaliFlatEditTourDetail;
      readonly baseline: unknown;
      readonly rowVersion: number;
    }
  | { readonly ok: false; readonly kind: "not-found" | "error"; readonly code: string };

export async function ensureWizardFlatEditChromeSurface(_pluginId: string): Promise<null> {
  return null;
}

export function useDenaliFlatEditPageCore(_input: never): never {
  throw new Error("No wizard flat-edit chrome surface registered");
}

export async function loadDenaliSubmitCatalogIds(): Promise<never> {
  throw new Error("No wizard flat-edit chrome surface registered");
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];
  for (const m of withSurface) {
    const block = m.wizardFlatEditChrome;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: wizardFlatEditChrome requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export};
  },`);
  }

  return `${BANNER}
type WizardFlatEditChromeSurface = {
  readonly useFlatEditPageCore: (input: never) => unknown;
  readonly loadSubmitCatalog: (...args: never[]) => Promise<unknown>;
};

const WIZARD_FLAT_EDIT_CHROME_LOADERS: Readonly<
  Record<string, () => Promise<WizardFlatEditChromeSurface>>
> = Object.freeze({
${loaderEntries.join("\n")}
}) as Readonly<Record<string, () => Promise<WizardFlatEditChromeSurface>>>;

const wizardFlatEditChromeCache = new Map<string, WizardFlatEditChromeSurface>();

/** Warm flat-edit chrome surface (hooks + catalog loader) via dynamic import. */
export async function ensureWizardFlatEditChromeSurface(
  pluginId: string
): Promise<WizardFlatEditChromeSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = wizardFlatEditChromeCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = WIZARD_FLAT_EDIT_CHROME_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  wizardFlatEditChromeCache.set(pluginId, surface);
  return surface;
}

function requireWizardFlatEditChromeSurface(pluginId: string): WizardFlatEditChromeSurface {
  const surface = wizardFlatEditChromeCache.get(pluginId);
  if (surface == null) {
    throw new Error(
      \`No wizard flat-edit chrome for plugin: \${pluginId} (call ensureWizardFlatEditChromeSurface first)\`
    );
  }
  return surface;
}

/**
 * Shell hook wrapper — always invokes product hook after warm (no conditional hook calls).
 * Resolves surface via \`input.plugin.id\`.
 */
export function useDenaliFlatEditPageCore(input: {
  readonly plugin: { readonly id: string };
}): unknown {
  const surface = requireWizardFlatEditChromeSurface(input.plugin.id);
  return surface.useFlatEditPageCore(input as never);
}

export async function loadDenaliSubmitCatalogIds(
  ...args: never[]
): Promise<unknown> {
  for (const surface of wizardFlatEditChromeCache.values()) {
    return surface.loadSubmitCatalog(...args);
  }
  throw new Error("loadDenaliSubmitCatalogIds: flat-edit chrome cache cold (call ensure first)");
}

/** Shell-local mirrors (Gap Closure B.8 — no product type re-export). */
export type DenaliFlatEditTourDetail = {
  readonly projection: {
    readonly title: string;
    readonly uiStatus: string;
    readonly priceAmount: number | null;
    readonly priceCurrency: string | null;
    readonly departureAt: string | null;
    readonly acceptedSeats: number;
    readonly capacity: number | null;
  };
};

export type DenaliFlatEditTourLoadResult =
  | {
      readonly ok: true;
      readonly detail: DenaliFlatEditTourDetail;
      readonly baseline: unknown;
      readonly rowVersion: number;
    }
  | { readonly ok: false; readonly kind: "not-found" | "error"; readonly code: string };

/** Gap Closure B.20 — product-blind aliases for shell facades. */
export const useOperatorFlatEditPageCore = useDenaliFlatEditPageCore;
export const loadOperatorSubmitCatalogIds = loadDenaliSubmitCatalogIds;
`;
}

export function generateWizardFlatEditFormBindings(manifests) {
  const withSurface = manifests.filter((m) => m.wizardFlatEditForm !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
import type { ComponentType } from "react";

export type DenaliTourWizardDraft = { readonly data: Record<string, unknown> };
export type DenaliFlatEditFormProps = Record<string, unknown>;

export type WizardFlatEditFormSurface = {
  readonly FlatEditForm: ComponentType<any>;
  readonly testIds: unknown;
};

export async function ensureWizardFlatEditFormSurface(
  _pluginId: string
): Promise<WizardFlatEditFormSurface | null> {
  return null;
}

export function resolveWizardFlatEditFormSurface(
  _pluginId: string
): WizardFlatEditFormSurface | null {
  return null;
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];
  for (const m of withSurface) {
    const block = m.wizardFlatEditForm;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: wizardFlatEditForm requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export} as WizardFlatEditFormSurface;
  },`);
  }

  return `${BANNER}
import type { ComponentType } from "react";

export type DenaliTourWizardDraft = { readonly data: Record<string, unknown> };
export type DenaliFlatEditFormProps = Record<string, unknown>;

export type WizardFlatEditFormSurface = {
  readonly FlatEditForm: ComponentType<any>;
  readonly testIds: unknown;
};

const WIZARD_FLAT_EDIT_FORM_LOADERS: Readonly<
  Record<string, () => Promise<WizardFlatEditFormSurface>>
> = Object.freeze({
${loaderEntries.join("\n")}
});

const wizardFlatEditFormCache = new Map<string, WizardFlatEditFormSurface>();

/** Warm flat-edit form React surface via dynamic import. */
export async function ensureWizardFlatEditFormSurface(
  pluginId: string
): Promise<WizardFlatEditFormSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = wizardFlatEditFormCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = WIZARD_FLAT_EDIT_FORM_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  wizardFlatEditFormCache.set(pluginId, surface);
  return surface;
}

export function resolveWizardFlatEditFormSurface(
  pluginId: string
): WizardFlatEditFormSurface | null {
  return wizardFlatEditFormCache.get(pluginId) ?? null;
}

/** Sync test ids from warm surface (call ensure first). */
export function resolveDenaliFlatEditTestIds(pluginId: string): unknown {
  return wizardFlatEditFormCache.get(pluginId)?.testIds ?? null;
}
`;
}


export function generateWizardFlatEditPageBindings(manifests) {
  const withSurface = manifests.filter((m) => m.wizardFlatEditPage !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
import type { ComponentType } from "react";

export type WizardFlatEditPageSurface = {
  readonly FlatEditPageView: ComponentType<any>;
  readonly FlatEditValidationList: ComponentType<any>;
};

export async function ensureWizardFlatEditPageSurface(
  _pluginId: string
): Promise<WizardFlatEditPageSurface | null> {
  return null;
}

export function resolveWizardFlatEditPageSurface(
  _pluginId: string
): WizardFlatEditPageSurface | null {
  return null;
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];
  for (const m of withSurface) {
    const block = m.wizardFlatEditPage;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: wizardFlatEditPage requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export} as WizardFlatEditPageSurface;
  },`);
  }

  return `${BANNER}
import type { ComponentType } from "react";

export type WizardFlatEditPageSurface = {
  readonly FlatEditPageView: ComponentType<any>;
  readonly FlatEditValidationList: ComponentType<any>;
};

const WIZARD_FLAT_EDIT_PAGE_LOADERS: Readonly<
  Record<string, () => Promise<WizardFlatEditPageSurface>>
> = Object.freeze({
${loaderEntries.join("\n")}
});

const wizardFlatEditPageCache = new Map<string, WizardFlatEditPageSurface>();

/** Warm flat-edit page React surface via dynamic import (no static product fan-in). */
export async function ensureWizardFlatEditPageSurface(
  pluginId: string
): Promise<WizardFlatEditPageSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = wizardFlatEditPageCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = WIZARD_FLAT_EDIT_PAGE_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  wizardFlatEditPageCache.set(pluginId, surface);
  return surface;
}

/** Sync read of warm cache — call ensureWizardFlatEditPageSurface first. */
export function resolveWizardFlatEditPageSurface(
  pluginId: string
): WizardFlatEditPageSurface | null {
  return wizardFlatEditPageCache.get(pluginId) ?? null;
}
`;
}

export function generateWizardCreateViewBindings(manifests) {
  const withSurface = manifests.filter((m) => m.wizardCreateView !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
import type { ComponentType } from "react";

export type WizardCreateViewSurface = {
  readonly CreateTourWizardView: ComponentType<any>;
};

export async function ensureWizardCreateViewSurface(
  _pluginId: string
): Promise<WizardCreateViewSurface | null> {
  return null;
}

export function resolveWizardCreateViewSurface(
  _pluginId: string
): WizardCreateViewSurface | null {
  return null;
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];
  for (const m of withSurface) {
    const block = m.wizardCreateView;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: wizardCreateView requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export} as WizardCreateViewSurface;
  },`);
  }

  return `${BANNER}
import type { ComponentType } from "react";

export type WizardCreateViewSurface = {
  readonly CreateTourWizardView: ComponentType<any>;
};

const WIZARD_CREATE_VIEW_LOADERS: Readonly<
  Record<string, () => Promise<WizardCreateViewSurface>>
> = Object.freeze({
${loaderEntries.join("\n")}
});

const wizardCreateViewCache = new Map<string, WizardCreateViewSurface>();

/** Warm create wizard React view via dynamic import (no static product fan-in). */
export async function ensureWizardCreateViewSurface(
  pluginId: string
): Promise<WizardCreateViewSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = wizardCreateViewCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = WIZARD_CREATE_VIEW_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  wizardCreateViewCache.set(pluginId, surface);
  return surface;
}

/** Sync read of warm cache — call ensureWizardCreateViewSurface first. */
export function resolveWizardCreateViewSurface(
  pluginId: string
): WizardCreateViewSurface | null {
  return wizardCreateViewCache.get(pluginId) ?? null;
}
`;
}

export function generateWizardCompositeRegistryBindings(manifests) {
  const withSurface = manifests.filter((m) => m.wizardCompositeRegistry !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
/** Shell no longer static-reexports product composite maps (Gap Closure B.5). */
export const DENALI_COMPOSITE_BY_CANONICAL_PATH: Readonly<Record<string, string>> = Object.freeze({});
`;
  }

  // Product SOT remains in workspace package; web binder must not static-import it.
  void withSurface;
  return `${BANNER}
/**
 * Gap Closure B.5 — empty shell stub.
 * Canonical map: \`@app-tour/workspace-denali\` composites package (not static shell fan-in).
 */
export const DENALI_COMPOSITE_BY_CANONICAL_PATH: Readonly<Record<string, string>> = Object.freeze({});
`;
}

export function generateSettingsHubFallbackBindings(manifests) {
  const withFallback = manifests.filter((m) => m.settingsHubFallback?.enabled === true);
  if (withFallback.length === 0) {
    return `${BANNER}
import type { SettingsModuleMetadata } from "@/features/settings/settings-module-types";

export type SettingsHubFallbackPolicy = {
  readonly requiredModuleIds: readonly string[];
  readonly fallbackModules: Readonly<Record<string, SettingsModuleMetadata>>;
};

export async function ensureSettingsHubFallbackPolicy(
  _pluginId: string
): Promise<SettingsHubFallbackPolicy | null> {
  return null;
}

export function resolveSettingsHubFallbackPolicy(_pluginId: string): SettingsHubFallbackPolicy | null {
  return null;
}
`;
  }

  const denaliManifest = withFallback.find((m) => m.id === "denali");
  if (denaliManifest == null) {
    throw new Error("settingsHubFallback: enabled workspaces must include denali for web fallback policy");
  }

  const fallbackModulePath = importSpecifier(denaliManifest.package, "./settings/fallback-modules");

  return `${BANNER}
import type { SettingsModuleMetadata } from "@/features/settings/settings-module-types";
import { DENALI_BACKEND_REQUIRED_MODULE_IDS } from "@/features/settings/denali-required-settings-modules.generated";

export type SettingsHubFallbackPolicy = {
  readonly requiredModuleIds: readonly string[];
  readonly fallbackModules: Readonly<Record<string, SettingsModuleMetadata>>;
};

const SETTINGS_HUB_FALLBACK_LOADERS: Readonly<
  Record<string, () => Promise<SettingsHubFallbackPolicy>>
> = Object.freeze({
  ${JSON.stringify(denaliManifest.id)}: async () => {
    const mod = await import(${JSON.stringify(fallbackModulePath)});
    return Object.freeze({
      requiredModuleIds: DENALI_BACKEND_REQUIRED_MODULE_IDS,
      fallbackModules: mod.DENALI_FALLBACK_SETTINGS_MODULES,
    });
  },
});

const settingsHubFallbackCache = new Map<string, SettingsHubFallbackPolicy>();

export async function ensureSettingsHubFallbackPolicy(
  pluginId: string
): Promise<SettingsHubFallbackPolicy | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = settingsHubFallbackCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = SETTINGS_HUB_FALLBACK_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const policy = await load();
  settingsHubFallbackCache.set(pluginId, policy);
  return policy;
}

export function resolveSettingsHubFallbackPolicy(pluginId: string): SettingsHubFallbackPolicy | null {
  return settingsHubFallbackCache.get(pluginId) ?? null;
}

export { DENALI_BACKEND_REQUIRED_MODULE_IDS };
`;
}

export function generatePhotoUploadErrorsBindings(manifests) {
  const withSurface = manifests.filter((m) => m.photoUploadErrors !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
type PhotoUploadErrorsSurface = {
  readonly messageKeys: readonly string[];
  readonly extractApiErrorCode: (...args: never[]) => unknown;
  readonly normalizeErrorCode: (...args: never[]) => unknown;
  readonly parseApiErrorCode: (...args: never[]) => unknown;
  readonly resolvePhotoUploadError: (
    t: (key: string, values?: Record<string, string | number>) => string,
    code: string | null | undefined
  ) => string | null;
};

export async function ensurePhotoUploadErrorsSurface(
  _pluginId: string
): Promise<PhotoUploadErrorsSurface | null> {
  return null;
}

export function resolvePhotoUploadErrorsSurface(
  _pluginId: string
): PhotoUploadErrorsSurface | null {
  return null;
}

export function resolvePhotoUploadError(
  _t: (key: string, values?: Record<string, string | number>) => string,
  _code: string | null | undefined
): string | null {
  return null;
}
`;
  }

  /** @type {string[]} */
  const loaderEntries = [];
  for (const m of withSurface) {
    const block = m.photoUploadErrors;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: photoUploadErrors requires module and export`);
    }
    const importFrom = importSpecifier(m.package, block.module);
    loaderEntries.push(`  ${JSON.stringify(m.id)}: async () => {
    const mod = await import(${JSON.stringify(importFrom)});
    return mod.${block.export};
  },`);
  }

  return `${BANNER}
type PhotoUploadErrorsSurface = {
  readonly messageKeys: readonly string[];
  readonly extractApiErrorCode: (...args: never[]) => unknown;
  readonly normalizeErrorCode: (...args: never[]) => unknown;
  readonly parseApiErrorCode: (...args: never[]) => unknown;
  readonly resolvePhotoUploadError: (
    t: (key: string, values?: Record<string, string | number>) => string,
    code: string | null | undefined
  ) => string | null;
};

const PHOTO_UPLOAD_ERRORS_LOADERS: Readonly<
  Record<string, () => Promise<PhotoUploadErrorsSurface>>
> = Object.freeze({
${loaderEntries.join("\n")}
});

const photoUploadErrorsCache = new Map<string, PhotoUploadErrorsSurface>();

/** Warm product photo-error surface via dynamic import (no static fan-in). */
export async function ensurePhotoUploadErrorsSurface(
  pluginId: string
): Promise<PhotoUploadErrorsSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = photoUploadErrorsCache.get(pluginId);
  if (cached != null) {
    return cached;
  }
  const load = PHOTO_UPLOAD_ERRORS_LOADERS[pluginId];
  if (load == null) {
    return null;
  }
  const surface = await load();
  photoUploadErrorsCache.set(pluginId, surface);
  return surface;
}

export function resolvePhotoUploadErrorsSurface(
  pluginId: string
): PhotoUploadErrorsSurface | null {
  return photoUploadErrorsCache.get(pluginId) ?? null;
}

function firstWarmPhotoUploadErrorsSurface(): PhotoUploadErrorsSurface | null {
  for (const surface of photoUploadErrorsCache.values()) {
    return surface;
  }
  return null;
}

export function resolvePhotoUploadError(
  t: (key: string, values?: Record<string, string | number>) => string,
  code: string | null | undefined
): string | null {
  const surface = firstWarmPhotoUploadErrorsSurface();
  if (surface == null) {
    return null;
  }
  return surface.resolvePhotoUploadError(t, code);
}

export function extractPhotoApiErrorCode(
  payload: unknown,
  status?: number
): unknown {
  const surface = firstWarmPhotoUploadErrorsSurface();
  if (surface == null) {
    return null;
  }
  return surface.extractApiErrorCode(payload as never, status as never);
}

export function normalizePhotoErrorCode(code: unknown): unknown {
  const surface = firstWarmPhotoUploadErrorsSurface();
  if (surface == null) {
    return null;
  }
  return surface.normalizeErrorCode(code as never);
}

export function parsePhotoApiErrorCode(
  payload: unknown,
  status?: number
): unknown {
  const surface = firstWarmPhotoUploadErrorsSurface();
  if (surface == null) {
    return null;
  }
  return surface.parseApiErrorCode(payload as never, status as never);
}
`;
}

/**
 * Wave I.4 — Denali host adapter barrel (former wizard/denali/adapters.tsx package imports).
 * Emitted when a workspace declares id === "denali" (single product trunk adapter set).
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 */
export function generateDenaliHostAdapterBindings(manifests) {
  const denali = manifests.find((m) => m.id === "denali");
  if (denali == null || typeof denali.package !== "string") {
    return `${BANNER}
/** No denali workspace manifest — empty host adapter barrel (Wave I.4). */
export {};
`;
  }

  const pkg = denali.package;
  const draft = importSpecifier(pkg, "./draft");
  const metaLine = importSpecifier(pkg, "./ui/chrome/build-denali-flat-edit-meta-line");
  const loadResult = importSpecifier(pkg, "./ui/chrome/build-denali-flat-edit-tour-load-result");
  const httpStatus = importSpecifier(pkg, "./ui/chrome/map-denali-flat-edit-tour-http-status");
  const localize = importSpecifier(pkg, "./wizard/localize-validation-message");
  const prefetch = importSpecifier(pkg, "./ui/hooks/denali-wizard-catalog-prefetch-context");
  const sanitize = importSpecifier(pkg, "./wizard/catalog-sanitize");
  const catalogIds = importSpecifier(pkg, "./ui/adapters/read-active-catalog-ids-from-payload");
  const exposure = importSpecifier(pkg, "./ui/adapters/localize-exposure-catalog-fields");

  return `${BANNER}
import type { ComponentType, ReactNode } from "react";

/** Gap Closure B.10 — shell-local type mirrors (no static product import). */
export type DenaliEditTourRemoteDraftIdentity = {
  readonly namespace: string;
  readonly draftKey: string;
};

export type DenaliFlatEditTourHttpFailure = {
  readonly ok: false;
  readonly kind: "not-found" | "error";
  readonly code: string;
};

export type DenaliWizardCatalogPrefetch = {
  readonly initialLocationsResponse: unknown | null;
};

export type ExposureCatalogFieldForLocalization = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly adminLabel?: string;
};

type DenaliWizardCatalogPrefetchProviderProps = {
  readonly children: ReactNode;
  readonly initialLocationsResponse?: unknown | null;
};

/** Known product clone-support literal (matches workspace-denali draft binding SOT). */
export const DENALI_CREATE_TOUR_SUPPORTS_CLONE = true as const;

type DenaliHostAdaptersSurface = {
  readonly buildDenaliWizardFreshStartMeta: (...args: any[]) => any;
  readonly buildDenaliWizardStepZeroMeta: (...args: any[]) => any;
  readonly buildDenaliCreateTourDiscardRemoteDraftInput: (...args: any[]) => any;
  readonly denaliCreateTourRemoteDraftIdentity: (...args: any[]) => any;
  readonly prepareDenaliCreateTourFreshStartEnvelope: (...args: any[]) => any;
  readonly denaliEditTourRemoteDraftIdentity: (...args: any[]) => DenaliEditTourRemoteDraftIdentity;
  readonly buildDenaliFlatEditTourLoadSuccess: (...args: any[]) => any;
  readonly denaliFlatEditHydratorUnavailableResult: (...args: any[]) => any;
  readonly finalizeDenaliFlatEditTourLoad: (...args: any[]) => any;
  readonly mapDenaliFlatEditTourHttpStatus: (
    status: number
  ) => DenaliFlatEditTourHttpFailure | null;
  readonly DenaliWizardCatalogPrefetchProvider: ComponentType<DenaliWizardCatalogPrefetchProviderProps>;
  readonly useDenaliWizardCatalogPrefetch: () => DenaliWizardCatalogPrefetch;
  readonly readActiveDestinationIds: (...args: any[]) => any;
  readonly readActiveEquipmentIds: (...args: any[]) => any;
  readonly readActiveThemeIds: (...args: any[]) => any;
  readonly localizeExposureCatalogFields: (...args: any[]) => any;
  readonly buildDenaliFlatEditMetaLine: (...args: any[]) => any;
  readonly localizeDenaliValidationIssueMessage: (...args: any[]) => any;
  readonly resolveActiveCatalogIdsFromResourcePayloads: (...args: any[]) => any;
};

let denaliHostAdapters: DenaliHostAdaptersSurface | null = null;

/** Warm full Denali host-adapter surface via dynamic import (Gap Closure B.10). */
export async function ensureDenaliHostAdapters(): Promise<DenaliHostAdaptersSurface> {
  if (denaliHostAdapters != null) {
    return denaliHostAdapters;
  }
  const [
    draftMod,
    loadResultMod,
    httpStatusMod,
    prefetchMod,
    sanitizeMod,
    exposureMod,
    metaMod,
    localizeMod,
    catalogMod,
  ] = await Promise.all([
    import(${JSON.stringify(draft)}),
    import(${JSON.stringify(loadResult)}),
    import(${JSON.stringify(httpStatus)}),
    import(${JSON.stringify(prefetch)}),
    import(${JSON.stringify(sanitize)}),
    import(${JSON.stringify(exposure)}),
    import(${JSON.stringify(metaLine)}),
    import(${JSON.stringify(localize)}),
    import(${JSON.stringify(catalogIds)}),
  ]);
  denaliHostAdapters = Object.freeze({
    buildDenaliWizardFreshStartMeta: draftMod.buildDenaliWizardFreshStartMeta,
    buildDenaliWizardStepZeroMeta: draftMod.buildDenaliWizardStepZeroMeta,
    buildDenaliCreateTourDiscardRemoteDraftInput:
      draftMod.buildDenaliCreateTourDiscardRemoteDraftInput,
    denaliCreateTourRemoteDraftIdentity: draftMod.denaliCreateTourRemoteDraftIdentity,
    prepareDenaliCreateTourFreshStartEnvelope: draftMod.prepareDenaliCreateTourFreshStartEnvelope,
    denaliEditTourRemoteDraftIdentity: draftMod.denaliEditTourRemoteDraftIdentity,
    buildDenaliFlatEditTourLoadSuccess: loadResultMod.buildDenaliFlatEditTourLoadSuccess,
    denaliFlatEditHydratorUnavailableResult: loadResultMod.denaliFlatEditHydratorUnavailableResult,
    finalizeDenaliFlatEditTourLoad: loadResultMod.finalizeDenaliFlatEditTourLoad,
    mapDenaliFlatEditTourHttpStatus: httpStatusMod.mapDenaliFlatEditTourHttpStatus,
    DenaliWizardCatalogPrefetchProvider: prefetchMod.DenaliWizardCatalogPrefetchProvider,
    useDenaliWizardCatalogPrefetch: prefetchMod.useDenaliWizardCatalogPrefetch,
    readActiveDestinationIds: sanitizeMod.readActiveDestinationIds,
    readActiveEquipmentIds: sanitizeMod.readActiveEquipmentIds,
    readActiveThemeIds: sanitizeMod.readActiveThemeIds,
    localizeExposureCatalogFields: exposureMod.localizeExposureCatalogFields,
    buildDenaliFlatEditMetaLine: metaMod.buildDenaliFlatEditMetaLine,
    localizeDenaliValidationIssueMessage: localizeMod.localizeDenaliValidationIssueMessage,
    resolveActiveCatalogIdsFromResourcePayloads:
      catalogMod.resolveActiveCatalogIdsFromResourcePayloads,
  });
  return denaliHostAdapters;
}

/** @deprecated Prefer {@link ensureDenaliHostAdapters} (B.10). */
export async function ensureDenaliHostAdapterCountedFns(): Promise<DenaliHostAdaptersSurface> {
  return ensureDenaliHostAdapters();
}

function requireDenaliHostAdapters(): DenaliHostAdaptersSurface {
  if (denaliHostAdapters == null) {
    throw new Error("Denali host adapters cold (call ensureDenaliHostAdapters first)");
  }
  return denaliHostAdapters;
}

/** Sync Provider when warm; null when cold (CatalogShell self-warms). */
export function resolveDenaliWizardCatalogPrefetchProvider(): ComponentType<DenaliWizardCatalogPrefetchProviderProps> | null {
  return denaliHostAdapters?.DenaliWizardCatalogPrefetchProvider ?? null;
}

export function buildDenaliWizardFreshStartMeta(...args: any[]): any {
  return requireDenaliHostAdapters().buildDenaliWizardFreshStartMeta(...args);
}

export function buildDenaliWizardStepZeroMeta(...args: any[]): any {
  return requireDenaliHostAdapters().buildDenaliWizardStepZeroMeta(...args);
}

export function buildDenaliCreateTourDiscardRemoteDraftInput(...args: any[]): any {
  return requireDenaliHostAdapters().buildDenaliCreateTourDiscardRemoteDraftInput(...args);
}

export function denaliCreateTourRemoteDraftIdentity(...args: any[]): any {
  return requireDenaliHostAdapters().denaliCreateTourRemoteDraftIdentity(...args);
}

export function prepareDenaliCreateTourFreshStartEnvelope(...args: any[]): any {
  return requireDenaliHostAdapters().prepareDenaliCreateTourFreshStartEnvelope(...args);
}

export function denaliEditTourRemoteDraftIdentity(...args: any[]): DenaliEditTourRemoteDraftIdentity {
  return requireDenaliHostAdapters().denaliEditTourRemoteDraftIdentity(...args);
}

export function buildDenaliFlatEditTourLoadSuccess(...args: any[]): any {
  return requireDenaliHostAdapters().buildDenaliFlatEditTourLoadSuccess(...args);
}

export function denaliFlatEditHydratorUnavailableResult(...args: any[]): any {
  return requireDenaliHostAdapters().denaliFlatEditHydratorUnavailableResult(...args);
}

export function finalizeDenaliFlatEditTourLoad(...args: any[]): any {
  return requireDenaliHostAdapters().finalizeDenaliFlatEditTourLoad(...args);
}

export function mapDenaliFlatEditTourHttpStatus(
  status: number
): DenaliFlatEditTourHttpFailure | null {
  return requireDenaliHostAdapters().mapDenaliFlatEditTourHttpStatus(status);
}

export function readActiveDestinationIds(...args: any[]): any {
  return requireDenaliHostAdapters().readActiveDestinationIds(...args);
}

export function readActiveEquipmentIds(...args: any[]): any {
  return requireDenaliHostAdapters().readActiveEquipmentIds(...args);
}

export function readActiveThemeIds(...args: any[]): any {
  return requireDenaliHostAdapters().readActiveThemeIds(...args);
}

export function localizeExposureCatalogFields<T extends ExposureCatalogFieldForLocalization>(
  fields: readonly T[],
  translateWizard: (...args: any[]) => any
): readonly T[] {
  return requireDenaliHostAdapters().localizeExposureCatalogFields(fields, translateWizard) as readonly T[];
}

export function buildDenaliFlatEditMetaLine(...args: any[]): any {
  return requireDenaliHostAdapters().buildDenaliFlatEditMetaLine(...args);
}

export function localizeDenaliValidationIssueMessage(...args: any[]): any {
  return requireDenaliHostAdapters().localizeDenaliValidationIssueMessage(...args);
}

export function resolveActiveCatalogIdsFromResourcePayloads(...args: any[]): any {
  return requireDenaliHostAdapters().resolveActiveCatalogIdsFromResourcePayloads(...args);
}

/** Gap Closure B.20 — product-blind aliases for shell facades (token ratchet). */
export const ensureWizardHostAdapters = ensureDenaliHostAdapters;
export const resolveWizardCatalogPrefetchProvider = resolveDenaliWizardCatalogPrefetchProvider;
export const buildWizardFreshStartMeta = buildDenaliWizardFreshStartMeta;
export const buildWizardStepZeroMeta = buildDenaliWizardStepZeroMeta;
export const buildCreateTourDiscardRemoteDraftInput = buildDenaliCreateTourDiscardRemoteDraftInput;
export const CREATE_TOUR_SUPPORTS_CLONE = DENALI_CREATE_TOUR_SUPPORTS_CLONE;
export const createTourRemoteDraftIdentity = denaliCreateTourRemoteDraftIdentity;
export const prepareCreateTourFreshStartEnvelope = prepareDenaliCreateTourFreshStartEnvelope;
export const editTourRemoteDraftIdentity = denaliEditTourRemoteDraftIdentity;
export const buildFlatEditMetaLine = buildDenaliFlatEditMetaLine;
export const finalizeFlatEditTourLoad = finalizeDenaliFlatEditTourLoad;
export const mapFlatEditTourHttpStatus = mapDenaliFlatEditTourHttpStatus;
export const localizeWizardValidationIssueMessage = localizeDenaliValidationIssueMessage;
/** Wire error code value retained; shell imports the neutral constant name only. */
export const WIZARD_RULES_NOT_READY_CODE = "DENALI_RULES_NOT_READY";
`;
}
