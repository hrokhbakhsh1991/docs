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

export function resolveGeneratedCompositeSurface(
  _surfaceId: string | undefined
): WizardCompositeSurface | null {
  return null;
}

export function resolveGeneratedReviewSurface(
  _surfaceId: string | undefined
): WizardReviewSurface | null {
  return null;
}
`;
  }

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const compositeEntries = [];
  /** @type {string[]} */
  const reviewEntries = [];

  for (const m of withSurfaces) {
    const ws = m.wizardSurfaces;
    const surfaceId = ws.surfaceId ?? m.id;
    if (ws.composite !== undefined) {
      const alias = `composite_${m.id.replace(/-/g, "_")}`;
      importLines.add(
        `import { ${ws.composite.export} as ${alias} } from "${ws.composite.webModule}";`
      );
      compositeEntries.push(`  ${JSON.stringify(surfaceId)}: ${alias}(),`);
    }
    if (ws.review !== undefined) {
      const alias = `review_${m.id.replace(/-/g, "_")}`;
      importLines.add(`import { ${ws.review.export} as ${alias} } from "${ws.review.webModule}";`);
      reviewEntries.push(`  ${JSON.stringify(surfaceId)}: ${alias}(),`);
    }
  }

  importLines.add(
    `import { createPlatformCompositeSurface as composite_platform } from "@/wizard/platform/platform-composite-surface";`
  );
  compositeEntries.push(`  "platform": composite_platform(),`);

  importLines.add(
    `import { createPlatformReviewSurface as review_platform } from "@/wizard/platform/platform-review-surface";`
  );
  reviewEntries.push(`  "platform": review_platform(),`);

  return `${BANNER}
import type { WizardCompositeSurface, WizardReviewSurface } from "@/wizard/wizard-surface-types";
${[...importLines].join("\n")}

const COMPOSITE_SURFACES: Readonly<Record<string, WizardCompositeSurface>> = Object.freeze({
${compositeEntries.join("\n")}
});

const REVIEW_SURFACES: Readonly<Record<string, WizardReviewSurface>> = Object.freeze({
${reviewEntries.join("\n")}
});

export function resolveGeneratedCompositeSurface(
  surfaceId: string | undefined
): WizardCompositeSurface | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return COMPOSITE_SURFACES[surfaceId] ?? null;
}

export function resolveGeneratedReviewSurface(
  surfaceId: string | undefined
): WizardReviewSurface | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return REVIEW_SURFACES[surfaceId] ?? null;
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

export function resolveGeneratedLabelResolver(
  _surfaceId: string | undefined
): WizardLabelResolver | null {
  return null;
}
`;
  }

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const labelEntries = [];

  for (const m of withI18n) {
    const i18n = m.wizardI18n;
    const surfaceId = m.wizardSurfaces?.surfaceId ?? m.id;
    const lr = i18n.labelResolver;
    const alias = `label_${m.id.replace(/-/g, "_")}`;
    importLines.add(`import { ${lr.export} as ${alias} } from "${lr.webModule}";`);
    labelEntries.push(`  ${JSON.stringify(surfaceId)}: ${alias}(),`);
  }

  return `${BANNER}
import type { WizardLabelResolver } from "@/wizard/wizard-surface-types";
${[...importLines].join("\n")}

export const WORKSPACE_WIZARD_I18N_NAMESPACES = ${JSON.stringify(uniqueNamespaces)} as const;

const LABEL_RESOLVERS: Readonly<Record<string, WizardLabelResolver>> = Object.freeze({
${labelEntries.join("\n")}
});

export function resolveGeneratedLabelResolver(
  surfaceId: string | undefined
): WizardLabelResolver | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return LABEL_RESOLVERS[surfaceId] ?? null;
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
  const withEditor = manifests.filter((m) => m.wizardTemplateEditor !== undefined);
  if (withEditor.length === 0) {
    return `${BANNER}
import type { WizardTemplateEditorSurface } from "@/wizard/wizard-template-editor-types";

export function resolveWizardTemplateEditor(
  _pluginId: string
): WizardTemplateEditorSurface | null {
  return null;
}
`;
  }

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const editorEntries = [];

  for (const m of withEditor) {
    const editor = m.wizardTemplateEditor;
    if (typeof editor.module !== "string" || typeof editor.export !== "string") {
      throw new Error(`${m.id}: wizardTemplateEditor requires module and export`);
    }
    const alias = `editor_${m.id.replace(/-/g, "_")}`;
    const importFrom = importSpecifier(m.package, editor.module);
    importLines.add(`import { ${editor.export} as ${alias} } from "${importFrom}";`);
    editorEntries.push(`  ${JSON.stringify(m.id)}: ${alias},`);
  }

  return `${BANNER}
import type { WizardTemplateEditorSurface } from "@/wizard/wizard-template-editor-types";
${[...importLines].join("\n")}

const WIZARD_TEMPLATE_EDITORS: Readonly<Record<string, WizardTemplateEditorSurface>> = Object.freeze({
${editorEntries.join("\n")}
});

export function resolveWizardTemplateEditor(
  pluginId: string
): WizardTemplateEditorSurface | null {
  return WIZARD_TEMPLATE_EDITORS[pluginId] ?? null;
}
`;
}

export function generateMarketingCatalogBindings(manifests) {
  const withCatalog = manifests.filter((m) => m.marketingCatalog !== undefined);
  if (withCatalog.length === 0) {
    return `${BANNER}
import type { MarketingCatalogSurface } from "@/catalog/marketing-catalog-surface-types";

export function resolveMarketingCatalogSurface(
  _pluginId: string
): MarketingCatalogSurface | null {
  return null;
}
`;
  }

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const catalogEntries = [];

  for (const m of withCatalog) {
    const catalog = m.marketingCatalog;
    if (typeof catalog.module !== "string" || typeof catalog.export !== "string") {
      throw new Error(`${m.id}: marketingCatalog requires module and export`);
    }
    const alias = `catalog_${m.id.replace(/-/g, "_")}`;
    const importFrom = importSpecifier(m.package, catalog.module);
    importLines.add(`import { ${catalog.export} as ${alias} } from "${importFrom}";`);
    catalogEntries.push(`  ${JSON.stringify(m.id)}: ${alias},`);
  }

  return `${BANNER}
import type { MarketingCatalogSurface } from "@/catalog/marketing-catalog-surface-types";
${[...importLines].join("\n")}

const MARKETING_CATALOG_SURFACES: Readonly<Record<string, MarketingCatalogSurface>> = Object.freeze({
${catalogEntries.join("\n")}
});

export function resolveMarketingCatalogSurface(
  pluginId: string
): MarketingCatalogSurface | null {
  return MARKETING_CATALOG_SURFACES[pluginId] ?? null;
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
  const withSurface = manifests.filter((m) => m[manifestKey] !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
import type { ${typeName} } from "${typeImportPath}";

export function ${resolveFn}(
  _pluginId: string
): ${typeName} | null {
  return null;
}
`;
  }

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const entries = [];

  for (const m of withSurface) {
    const block = m[manifestKey];
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: ${manifestKey} requires module and export`);
    }
    const alias = `${aliasPrefix}_${m.id.replace(/-/g, "_")}`;
    const importFrom = importSpecifier(m.package, block.module);
    importLines.add(`import { ${block.export} as ${alias} } from "${importFrom}";`);
    entries.push(`  ${JSON.stringify(m.id)}: ${alias},`);
  }

  return `${BANNER}
import type { ${typeName} } from "${typeImportPath}";
${[...importLines].join("\n")}

const ${recordConst}: Readonly<Record<string, ${typeName}>> = Object.freeze({
${entries.join("\n")}
});

export function ${resolveFn}(
  pluginId: string
): ${typeName} | null {
  return ${recordConst}[pluginId] ?? null;
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

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const codecEntries = [];

  for (const m of withCodec) {
    const block = m.tourActionSubmitCodec;
    if (typeof block.module !== "string" || typeof block.export !== "string") {
      throw new Error(`${m.id}: tourActionSubmitCodec requires module and export`);
    }
    const alias = `codec_${m.id.replace(/-/g, "_")}`;
    const importFrom = importSpecifier(m.package, block.module);
    importLines.add(`import { ${block.export} as ${alias} } from "${importFrom}";`);
    codecEntries.push(`  ${JSON.stringify(m.id)}: ${alias},`);
  }

  const firstAlias = `codec_${withCodec[0].id.replace(/-/g, "_")}`;

  return `${BANNER}
import type { TourActionSubmitErrorPayload } from "${importSpecifier(withCodec[0].package, "./ui/logic/tour-action-submit-codec-surface")}";
${[...importLines].join("\n")}

const TOUR_ACTION_SUBMIT_CODECS = Object.freeze({
${codecEntries.join("\n")}
});

export type { TourActionSubmitErrorPayload };

export function encodeTourActionSubmitErrorForPlugin(
  pluginId: string,
  payload: TourActionSubmitErrorPayload
): string {
  const codec = TOUR_ACTION_SUBMIT_CODECS[pluginId as keyof typeof TOUR_ACTION_SUBMIT_CODECS];
  if (codec == null) {
    throw new Error(\`No tour action submit codec for plugin: \${pluginId}\`);
  }
  return codec.encode(payload);
}

export function decodeTourActionSubmitError(
  raw: string
): TourActionSubmitErrorPayload | null {
  for (const codec of Object.values(TOUR_ACTION_SUBMIT_CODECS)) {
    const decoded = codec.decode(raw);
    if (decoded != null) {
      return decoded;
    }
  }
  return null;
}

/** @deprecated Use encodeTourActionSubmitErrorForPlugin — retained for tests */
export function encodeTourActionSubmitError(
  payload: TourActionSubmitErrorPayload
): string {
  return ${firstAlias}.encode(payload);
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
export function resolveOperatorUiComponentsSurface(_pluginId: string): null {
  return null;
}
`;
  }

  const m = withSurface[0];
  const block = m.operatorUiComponents;
  if (typeof block.module !== "string" || typeof block.export !== "string") {
    throw new Error(`${m.id}: operatorUiComponents requires module and export`);
  }
  const importFrom = importSpecifier(m.package, block.module);
  const alias = `ui_${m.id.replace(/-/g, "_")}`;

  return `${BANNER}
import { ${block.export} as ${alias} } from "${importFrom}";
import type { ComponentProps } from "react";

const OPERATOR_UI_COMPONENTS = Object.freeze({
  ${JSON.stringify(m.id)}: ${alias},
});

export function resolveOperatorUiComponentsSurface(pluginId: string) {
  return OPERATOR_UI_COMPONENTS[pluginId as keyof typeof OPERATOR_UI_COMPONENTS] ?? null;
}

export const DenaliTimeInput = ${alias}.TimeInput;
export type DenaliTimeInputProps = ComponentProps<typeof DenaliTimeInput>;
export type DenaliTimeInputAppearance = DenaliTimeInputProps["appearance"];

export const DenaliDifficultyRangeSlider = ${alias}.DifficultyRangeSlider;
export type DenaliDifficultyRangeSliderProps = ComponentProps<typeof DenaliDifficultyRangeSlider>;

export const DenaliLocationPickerMap = ${alias}.LocationPickerMap;
export const DenaliLocationPickerMapInner = ${alias}.LocationPickerMapInner;
export const ensureLeafletDefaultIcon = ${alias}.ensureLeafletDefaultIcon;
export type {
  DenaliMapCoordinates,
  DenaliLocationPickerMapInnerProps,
} from "${importSpecifier(m.package, "./ui/components/location-picker-map")}";

export const DenaliWizardDatetimePicker = ${alias}.WizardDatetimePicker;
`;
}

export function generateWizardDraftUnificationBindings(manifests) {
  const withSurface = manifests.filter((m) => m.wizardDraftUnification !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
export function logWizardDraftTombstoneShadowMismatch(
  _mode: string,
  _baseline: unknown,
  _local: unknown,
  _server: unknown
): void {}
`;
  }

  const m = withSurface[0];
  const block = m.wizardDraftUnification;
  if (typeof block.module !== "string" || typeof block.export !== "string") {
    throw new Error(`${m.id}: wizardDraftUnification requires module and export`);
  }
  const importFrom = importSpecifier(m.package, block.module);
  const alias = `draft_unification_${m.id.replace(/-/g, "_")}`;

  return `${BANNER}
import { ${block.export} as ${alias} } from "${importFrom}";

export function logWizardDraftTombstoneShadowMismatch(
  ...args: Parameters<typeof ${alias}.logTombstoneShadowMismatch>
): void {
  ${alias}.logTombstoneShadowMismatch(...args);
}

export function resolveWizardDraftCreateTourDraftKey(pluginId: string): string | null {
  if (pluginId === ${JSON.stringify(m.id)}) {
    return ${alias}.createTourDraftKey;
  }
  return null;
}

export function readWizardDraftFieldValueFromRegistry(
  pluginId: string,
  draft: Record<string, unknown>,
  canonicalPath: string
): unknown | null {
  if (pluginId === ${JSON.stringify(m.id)}) {
    return ${alias}.readDraftFieldValue(draft, canonicalPath);
  }
  return null;
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
  return generateSingleWorkspaceSurfaceBindings(
    manifests,
    "wizardRules",
    "wizard_rules",
    "denaliWizardRulesSurface",
    {
      empty: `export function getWizardRulesModuleSync(_pluginId: string): never {
  throw new Error("No wizard rules surface registered");
}`,
      withSurface: (alias) => `
export type WizardRulesModule = {
  readonly evaluateFormFieldRule: typeof ${alias}.evaluateFormFieldRule;
  readonly applyDenaliInvariantState: typeof ${alias}.applyDenaliInvariantState;
  readonly resolveDenaliRuleSetFromTemplate: typeof ${alias}.resolveDenaliRuleSetFromTemplate;
  readonly buildDefaultForm: typeof ${alias}.buildDenaliTourCreateDefaultValues;
  readonly readCanonicalBasics: typeof ${alias}.readDenaliCanonicalBasics;
  readonly canonicalToFormPathMap: typeof ${alias}.canonicalToFormPathMap;
  readonly tourKindValues: typeof ${alias}.tourKindValues;
};

let wizardRulesModule: WizardRulesModule | null = null;

export function getWizardRulesModuleSync(pluginId: string): WizardRulesModule {
  if (pluginId !== "denali") {
    throw new Error(\`No wizard rules surface for plugin: \${pluginId}\`);
  }
  wizardRulesModule ??= Object.freeze({
    evaluateFormFieldRule: ${alias}.evaluateFormFieldRule,
    applyDenaliInvariantState: ${alias}.applyDenaliInvariantState,
    resolveDenaliRuleSetFromTemplate: ${alias}.resolveDenaliRuleSetFromTemplate,
    buildDefaultForm: ${alias}.buildDenaliTourCreateDefaultValues,
    readCanonicalBasics: ${alias}.readDenaliCanonicalBasics,
    canonicalToFormPathMap: ${alias}.canonicalToFormPathMap,
    tourKindValues: ${alias}.tourKindValues,
  }) as WizardRulesModule;
  return wizardRulesModule;
}

export function loadWizardRulesModule(pluginId: string): Promise<WizardRulesModule> {
  return Promise.resolve(getWizardRulesModuleSync(pluginId));
}`,
    }
  );
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
  const importLines = [];
  /** @type {string[]} */
  const augmentCases = [];
  for (const m of manifests) {
    const augment = m.wizardTemplateGate?.fieldOverlaysAugment;
    if (augment === undefined) {
      continue;
    }
    if (typeof augment.module !== "string" || typeof augment.export !== "string") {
      throw new Error(`${m.id}: wizardTemplateGate.fieldOverlaysAugment requires module and export`);
    }
    const alias = `field_overlays_${m.id.replace(/-/g, "_")}`;
    importLines.push(
      `import { ${augment.export} as ${alias} } from "${importSpecifier(m.package, augment.module)}";`
    );
    augmentCases.push(`  if (pluginId === ${JSON.stringify(m.id)}) {
    return ${alias}(templateSteps, baseOverlays);
  }`);
  }

  const preferTemplateDefaultsPluginIds = manifests
    .filter((m) => m.wizardTemplateGate?.preferTemplateDefaultsOnPrefill === true)
    .map((m) => m.id);

  return `${BANNER}
${importLines.length > 0 ? `${importLines.join("\n")}\n` : ""}/** Manifest-derived default step id when publishing an empty wizard template. */
export const WORKSPACE_WIZARD_TEMPLATE_GATE_DEFAULT_STEP_ID: Readonly<
  Record<string, string>
> = Object.freeze({
${entries.join("\n")}
});

export function resolveWizardTemplateGateDefaultPublishedStepId(pluginId: string): string {
  return WORKSPACE_WIZARD_TEMPLATE_GATE_DEFAULT_STEP_ID[pluginId] ?? ${JSON.stringify(platformDefault)};
}

/** Manifest-bound workspace augment for hidden composite template defaults (WEB-WIZ-013). */
export function augmentWizardTemplateFieldOverlays<
  T extends { readonly canonicalPath: string; readonly hidden?: boolean; readonly defaultValue?: string },
>(
  pluginId: string,
  templateSteps: readonly { readonly enabled?: boolean; readonly fields: readonly T[] }[],
  baseOverlays: ReadonlyMap<string, T>,
): ReadonlyMap<string, T> {
${augmentCases.length > 0 ? augmentCases.join("\n") : "  void pluginId;\n  void templateSteps;"}
  return baseOverlays;
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
  return generateSingleWorkspaceSurfaceBindings(
    manifests,
    "wizardTemplatePreset",
    "wizard_template_preset",
    "denaliWizardTemplatePresetSurface",
    {
      empty: `export function loadFullWizardTemplatePreset(_pluginId: string, _seedLabel?: string): Promise<never> {
  return Promise.reject(new Error("No wizard template preset surface registered"));
}`,
      withSurface: (alias) => `
export function loadFullWizardTemplatePreset(
  pluginId: string,
  seedLabel?: string
): Promise<import("@/features/settings/wizard-template-types").WizardTemplatePayload> {
  if (pluginId !== "denali") {
    return Promise.reject(new Error(\`No wizard template preset for plugin: \${pluginId}\`));
  }
  return Promise.resolve(${alias}.buildFullTemplatePreset(seedLabel));
}`,
    }
  );
}

export function generateWizardDraftShellBindings(manifests) {
  return generateSingleWorkspaceSurfaceBindings(
    manifests,
    "wizardDraftShell",
    "wizard_draft_shell",
    "denaliWizardDraftShellSurface",
    {
      empty: "",
      withSurface: (alias, m) => `
export const createDenaliWizardDraftSessionId = ${alias}.createWizardDraftSessionId;
export const DENALI_CREATE_TOUR_DRAFT_KEY = ${alias}.createTourDraftKey;
export const denaliEditTourDraftKey = ${alias}.editTourDraftKey;
export const DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE = ${alias}.operatorDraftNamespace;
export const createDenaliDraftSchemaGate = ${alias}.createDraftSchemaGate;
export const denaliHydrateDraftEnvelope = ${alias}.hydrateDraftEnvelope;
export const denaliPrepareDraftEnvelope = ${alias}.prepareDraftEnvelope;
export const isDenaliFreshStartEnvelope = ${alias}.isFreshStartEnvelope;
export const resolveDenaliDraftMerge = ${alias}.resolveDraftMerge;
export const emptyDenaliTourWizardDraft = ${alias}.emptyTourWizardDraft;
export const applyDenaliDefaultTourKind = ${alias}.applyDefaultTourKind;
export const buildDenaliCreatePrefilledFormCore = ${alias}.buildCreatePrefilledFormCore;
export const getDenaliWorkspacePluginFromDraftShell = ${alias}.getWorkspacePlugin;
export type { DenaliWizardDraftMeta } from "${importSpecifier(m.package, "./draft")}";
`,
    }
  );
}

export function generateWizardCreateChromeBindings(manifests) {
  return generateSingleWorkspaceSurfaceBindings(
    manifests,
    "wizardCreateChrome",
    "wizard_create_chrome",
    "denaliWizardCreateChromeSurface",
    {
      empty: "",
      withSurface: (alias, m) => `
export const useDenaliCreateTourWizardCore = ${alias}.useCreateTourWizardCore;
export const isDraftEssentiallyEmpty = ${alias}.isDraftEssentiallyEmpty;
export type { DenaliCreateTourWizardScreen } from "${importSpecifier(m.package, "./ui/chrome/wizard-create-chrome-surface")}";
`,
    }
  );
}

export function generateWizardFlatEditChromeBindings(manifests) {
  return generateSingleWorkspaceSurfaceBindings(
    manifests,
    "wizardFlatEditChrome",
    "wizard_flat_edit_chrome",
    "denaliWizardFlatEditChromeSurface",
    {
      empty: "",
      withSurface: (alias, m) => `
export const useDenaliFlatEditPageCore = ${alias}.useFlatEditPageCore;
export const loadDenaliSubmitCatalogIds = ${alias}.loadSubmitCatalog;
export type {
  DenaliFlatEditTourDetail,
  DenaliFlatEditTourLoadResult,
} from "${importSpecifier(m.package, "./ui/chrome/wizard-flat-edit-chrome-surface")}";
`,
    }
  );
}

export function generateWizardFlatEditFormBindings(manifests) {
  return generateSingleWorkspaceSurfaceBindings(
    manifests,
    "wizardFlatEditForm",
    "wizard_flat_edit_form",
    "denaliWizardFlatEditFormSurface",
    {
      empty: "",
      withSurface: (alias, m) => `
export const DenaliFlatEditForm = ${alias}.FlatEditForm;
export const DENALI_FLAT_EDIT_TEST_IDS = ${alias}.testIds;
export type {
  DenaliFlatEditFormProps,
  DenaliTourWizardDraft,
} from "${importSpecifier(m.package, "./ui/chrome/wizard-flat-edit-form-surface")}";
`,
    }
  );
}

export function generateWizardFlatEditPageBindings(manifests) {
  return generateSingleWorkspaceSurfaceBindings(
    manifests,
    "wizardFlatEditPage",
    "wizard_flat_edit_page",
    "denaliWizardFlatEditPageSurface",
    {
      empty: "",
      withSurface: (alias) => `
export const DenaliFlatEditPageView = ${alias}.FlatEditPageView;
export const DenaliFlatEditValidationList = ${alias}.FlatEditValidationList;
`,
    }
  );
}

export function generateWizardCreateViewBindings(manifests) {
  return generateSingleWorkspaceSurfaceBindings(
    manifests,
    "wizardCreateView",
    "wizard_create_view",
    "denaliWizardCreateViewSurface",
    {
      empty: "",
      withSurface: (alias) => `
export const DenaliCreateTourWizardView = ${alias}.CreateTourWizardView;
`,
    }
  );
}

export function generateWizardCompositeRegistryBindings(manifests) {
  return generateSingleWorkspaceSurfaceBindings(
    manifests,
    "wizardCompositeRegistry",
    "wizard_composite_registry",
    "denaliWizardCompositeRegistrySurface",
    {
      empty: `export const DENALI_COMPOSITE_BY_CANONICAL_PATH: Readonly<Record<string, string>> = Object.freeze({});`,
      withSurface: (alias) => `
export const DENALI_COMPOSITE_BY_CANONICAL_PATH = ${alias}.compositeByCanonicalPath;
`,
    }
  );
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

export function resolveSettingsHubFallbackPolicy(_pluginId: string): SettingsHubFallbackPolicy | null {
  return null;
}
`;
  }

  const denaliManifest = withFallback.find((m) => m.id === "denali");
  if (denaliManifest == null) {
    throw new Error("settingsHubFallback: enabled workspaces must include denali for web fallback policy");
  }

  return `${BANNER}
import type { SettingsModuleMetadata } from "@/features/settings/settings-module-types";
import { DENALI_BACKEND_REQUIRED_MODULE_IDS } from "@/features/settings/denali-required-settings-modules.generated";
import { DENALI_FALLBACK_SETTINGS_MODULES } from "@/features/settings/denali-fallback-settings-modules";

export type SettingsHubFallbackPolicy = {
  readonly requiredModuleIds: readonly string[];
  readonly fallbackModules: Readonly<Record<string, SettingsModuleMetadata>>;
};

const SETTINGS_HUB_FALLBACK_POLICIES = Object.freeze({
  ${JSON.stringify(denaliManifest.id)}: Object.freeze({
    requiredModuleIds: DENALI_BACKEND_REQUIRED_MODULE_IDS,
    fallbackModules: DENALI_FALLBACK_SETTINGS_MODULES,
  }),
});

export function resolveSettingsHubFallbackPolicy(pluginId: string): SettingsHubFallbackPolicy | null {
  return SETTINGS_HUB_FALLBACK_POLICIES[pluginId as keyof typeof SETTINGS_HUB_FALLBACK_POLICIES] ?? null;
}

export { DENALI_BACKEND_REQUIRED_MODULE_IDS };
`;
}

export function generatePhotoUploadErrorsBindings(manifests) {
  const withSurface = manifests.filter((m) => m.photoUploadErrors !== undefined);
  if (withSurface.length === 0) {
    return `${BANNER}
export function resolvePhotoUploadError(
  _t: (key: string, values?: Record<string, string | number>) => string,
  _code: string | null | undefined
): string | null {
  return null;
}
`;
  }

  const m = withSurface[0];
  const block = m.photoUploadErrors;
  if (typeof block.module !== "string" || typeof block.export !== "string") {
    throw new Error(`${m.id}: photoUploadErrors requires module and export`);
  }
  const importFrom = importSpecifier(m.package, block.module);
  const alias = `photo_errors_${m.id.replace(/-/g, "_")}`;

  return `${BANNER}
import { ${block.export} as ${alias} } from "${importFrom}";

export const PHOTO_UPLOAD_ERROR_MESSAGE_KEYS = ${alias}.messageKeys;

export const extractPhotoApiErrorCode = ${alias}.extractApiErrorCode;
export const normalizePhotoErrorCode = ${alias}.normalizeErrorCode;
export const parsePhotoApiErrorCode = ${alias}.parseApiErrorCode;

export function resolvePhotoUploadError(
  t: (key: string, values?: Record<string, string | number>) => string,
  code: string | null | undefined
): string | null {
  return ${alias}.resolvePhotoUploadError(t, code);
}
`;
}
