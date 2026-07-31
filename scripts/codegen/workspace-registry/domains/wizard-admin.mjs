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
    if (wm.isOperatorReadKeyAllowedExport != null) {
      exportNames.push(wm.isOperatorReadKeyAllowedExport);
    }
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
    if (wm.isOperatorReadKeyAllowedExport != null) {
      bindingProps.push(`isOperatorReadKeyAllowed: ${wm.isOperatorReadKeyAllowedExport}`);
    }
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
/** Manifest-driven mediaRouteKey → web BFF path (private; Phase 4f). */
const WIZARD_MEDIA_ROUTE_BFF_PATHS = Object.freeze({
${bffEntries.join("\n")}
}) as Readonly<Record<string, string>>;

export function isKnownWizardMediaRouteBffKey(mediaRouteKey: string): boolean {
  return mediaRouteKey.trim() in WIZARD_MEDIA_ROUTE_BFF_PATHS;
}

/** Manifest BFF path for key, if declared. */
export function lookupWizardMediaRouteBffPath(mediaRouteKey: string): string | undefined {
  return WIZARD_MEDIA_ROUTE_BFF_PATHS[mediaRouteKey.trim()];
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

/** Manifest-driven mediaRouteKey → API backend proxy paths (private; Phase 4f). */
const WIZARD_MEDIA_ROUTE_BACKEND_PATHS = Object.freeze({
${backendEntries.join("\n")}
}) as Readonly<Record<string, WizardMediaBackendPaths>>;

export function isKnownWizardMediaRouteBackendKey(mediaRouteKey: string): boolean {
  return mediaRouteKey.trim() in WIZARD_MEDIA_ROUTE_BACKEND_PATHS;
}

/** Manifest backend paths for key, if declared. */
export function lookupWizardMediaRouteBackendPaths(
  mediaRouteKey: string
): WizardMediaBackendPaths | undefined {
  return WIZARD_MEDIA_ROUTE_BACKEND_PATHS[mediaRouteKey.trim()];
}
`;
}

export function generateWizardSurfaceBindings(_manifests) {
  throw new Error(
    "Phase 4as — wizardSurfaces codegen removed; capabilities.wizardSurfaces + shell registry own composite/review surfaces"
  );
}

export function generateWizardLabelBindings(_manifests) {
  throw new Error(
    "Phase 4aq — wizardLabels codegen removed; capabilities.labels + shell registry own label resolvers; i18n namespaces live on wizard-i18n-translator-hooks"
  );
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

  return `${BANNER}
/** Manifest + platform wizard message namespaces (private; Phase 4i / 4aq; slimmed Phase 4bh). */
const WORKSPACE_WIZARD_I18N_NAMESPACES = ${JSON.stringify(namespaces)} as const;

export type WorkspaceWizardI18nNamespace = (typeof WORKSPACE_WIZARD_I18N_NAMESPACES)[number];

export function isWorkspaceWizardI18nNamespace(
  value: string
): value is WorkspaceWizardI18nNamespace {
  return (WORKSPACE_WIZARD_I18N_NAMESPACES as readonly string[]).includes(value);
}

/** Declared wizard i18n namespaces (tests / label resolvers). */
export function listWorkspaceWizardI18nNamespaces(): readonly WorkspaceWizardI18nNamespace[] {
  return WORKSPACE_WIZARD_I18N_NAMESPACES;
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

export function generateWizardCreateBindings(_manifests) {
  throw new Error(
    "Phase 4bg — wizardCreate web binder codegen removed; capabilities.wizardCreate owns extendedChrome + brand mark"
  );
}

/** @param {ReturnType<typeof discoverManifests>} manifests */

export function generateWizardTemplateEditorBindings(_manifests) {
  throw new Error(
    "Phase 4aw — wizardTemplateEditorBindings codegen removed; capabilities.templateEditor owns editor surface"
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

export function generateSettingsDestinationBindings(_manifests) {
  throw new Error(
    "Phase 4az — settingsDestinationBindings codegen removed; capabilities.settingsDestination owns destination surface"
  );
}

export function generateSettingsEquipmentUiBindings(_manifests) {
  throw new Error(
    "Phase 4ba — settingsEquipmentUiBindings codegen removed; capabilities.settingsEquipmentUi owns equipment UI surface"
  );
}

export function generateSettingsExposureSurfacesUiBindings(_manifests) {
  throw new Error(
    "Phase 4bb — settingsExposureSurfacesUiBindings codegen removed; capabilities.settingsExposureSurfacesUi owns exposure surfaces UI"
  );
}

export function generateTourActionSubmitBindings(_manifests) {
  throw new Error(
    "Phase 4ap — tourActionSubmitBindings codegen removed; capabilities.tourActionSubmit + shell platform codec own submit errors"
  );
}

export function generateTourListCategoryBindings(_manifests) {
  throw new Error(
    "Phase 4ax — tourListCategoryBindings codegen removed; capabilities.tourListCategory owns category surface"
  );
}

export function generateOperatorUiComponentsBindings(_manifests) {
  throw new Error(
    "Phase 4ao — operatorUiComponentsBindings codegen removed; capabilities.operatorUi + shell registry own operator UI"
  );
}

export function generateWizardDraftUnificationBindings(_manifests) {
  throw new Error(
    "Phase 4am — wizardDraftUnificationBindings codegen removed; capabilities.draftShell owns unification helpers"
  );
}

export function generateWizardRulesBindings(_manifests) {
  throw new Error(
    "Phase 4at — web wizardRulesBindings codegen removed; shell uses wizardHost.loadRulesModule (API apiWizardRules deferred)"
  );
}

export function generateWizardTemplatePresetBindings(_manifests) {
  throw new Error(
    "Phase 4au — wizardTemplatePresetBindings codegen removed; capabilities.templatePreset owns buildFullTemplatePreset"
  );
}

export function generateWizardDraftShellBindings(_manifests) {
  throw new Error(
    "Phase 4al — wizardDraftShellBindings codegen removed; capabilities.draftShell + wizardHost own draft shell"
  );
}

export function generateWizardCreateChromeBindings(_manifests) {
  throw new Error(
    "Phase 4ag — wizardCreateChromeBindings codegen removed; shell registry + capabilities.createChrome own create-chrome"
  );
}


export function generateWizardFlatEditChromeBindings(_manifests) {
  throw new Error(
    "Phase 4ah — wizardFlatEditChromeBindings codegen removed; shell registry + capabilities.flatEditChrome own flat-edit chrome"
  );
}

export function generateWizardFlatEditFormBindings(_manifests) {
  throw new Error(
    "Phase 4ai — wizardFlatEditFormBindings codegen removed; shell registry + capabilities.flatEditForm own flat-edit form"
  );
}

export function generateWizardFlatEditPageBindings(_manifests) {
  throw new Error(
    "Phase 4aj — wizardFlatEditPageBindings codegen removed; shell registry + capabilities.flatEditPage own flat-edit page"
  );
}

export function generateWizardCreateViewBindings(_manifests) {
  throw new Error(
    "Phase 4ak — wizardCreateViewBindings codegen removed; shell registry + capabilities.createView own create-view"
  );
}

export function generateSettingsHubFallbackBindings(_manifests) {
  throw new Error(
    "Phase 4av — settingsHubFallbackBindings codegen removed; capabilities.settingsHubFallback owns hub recovery policy"
  );
}

export function generatePhotoUploadErrorsBindings(_manifests) {
  throw new Error(
    "Phase 4ay — photoUploadErrorsBindings codegen removed; orphaned web binder deleted (package surface remains SOT)"
  );
}

/** Phase 2d — generateDenaliHostAdapterBindings removed (shell registry owns host adapters). */
