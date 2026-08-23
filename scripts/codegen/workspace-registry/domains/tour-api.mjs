import { BANNER } from "../constants.mjs";
import { assertNoDuplicateEmittedSymbols, importSpecifier } from "../utils.mjs";

const PUBLISH_VISIBILITY_REQUIRED_WORKSPACES = new Set(["denali", "urban", "harbor"]);
const PUBLISH_LABEL_MAPPING_REQUIRED_WORKSPACES = new Set(["denali", "urban", "harbor"]);
const TOUR_LIST_PROJECTION_REQUIRED_WORKSPACES = new Set(["denali", "urban"]);

function namedImportLine(names, specifier) {
  if (names.length <= 1) {
    return `import { ${names.join(", ")} } from "${specifier}";`;
  }
  return `import {
  ${names.join(",\n  ")},
} from "${specifier}";`;
}

export function generateCanonicalTourBindings(manifests) {
  const withCanonicalTour = manifests.filter((m) => m.canonicalTour !== undefined);
  if (withCanonicalTour.length === 0) {
    return `${BANNER}
export const WORKSPACE_CANONICAL_TOUR_BINDINGS = [] as const;
`;
  }

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of withCanonicalTour) {
    const ct = m.canonicalTour;
    const tw = m.tourWrite;
    if (tw === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: canonicalTour requires tourWrite.workspaceTypeExport`
      );
    }
    importLines.add(namedImportLine([tw.workspaceTypeExport], m.package));
    const publishSpec = importSpecifier(m.package, ct.publishStatusModule);
    importLines.add(
      namedImportLine([ct.publishStatusReadExport, ct.publishTransitionExport], publishSpec)
    );
    let migrateField = "";
    if (ct.migrateModule !== undefined && ct.migrateExport !== undefined) {
      const migrateSpec = importSpecifier(m.package, ct.migrateModule);
      /** @type {string[]} */
      const migrateImports = [ct.migrateExport];
      let migrateSurfaceFields = "";
      if (
        ct.legacySoTRootExport != null &&
        ct.currentSchemaVersionExport != null &&
        ct.legacySchemaVersionExport != null &&
        ct.wrapLegacyExport != null
      ) {
        migrateImports.push(
          ct.legacySoTRootExport,
          ct.currentSchemaVersionExport,
          ct.legacySchemaVersionExport,
          ct.wrapLegacyExport
        );
        migrateSurfaceFields = `
    legacySoTRoot: ${ct.legacySoTRootExport},
    currentSchemaVersion: ${ct.currentSchemaVersionExport},
    legacySchemaVersion: ${ct.legacySchemaVersionExport},
    wrapLegacyCanonical: ${ct.wrapLegacyExport},`;
      }
      importLines.add(namedImportLine(migrateImports, migrateSpec));
      migrateField = `\n    migrateCanonical: ${ct.migrateExport},${migrateSurfaceFields}`;
    }
    let formProfileGhostPathsField = "";
    if (
      ct.formProfileGhostPathsModule !== undefined &&
      ct.formProfileGhostPathsExport !== undefined
    ) {
      const ghostSpec = importSpecifier(m.package, ct.formProfileGhostPathsModule);
      importLines.add(namedImportLine([ct.formProfileGhostPathsExport], ghostSpec));
      formProfileGhostPathsField = `\n    formProfileGhostPaths: ${ct.formProfileGhostPathsExport},`;
    }
    const validationSyncOnlyField =
      ct.validationSyncOnly === true ? `\n    validationSyncOnly: true as const,` : "";
    const catalogRefEnrichmentField =
      ct.catalogRefEnrichment === true ? `\n    catalogRefEnrichment: true as const,` : "";
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    readPublishStatusFromCanonical: ${ct.publishStatusReadExport},
    detectPublishTransition: ${ct.publishTransitionExport},${migrateField}${formProfileGhostPathsField}${validationSyncOnlyField}${catalogRefEnrichmentField}
  },`);
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_CANONICAL_TOUR_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;
`;
}

/** @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>} manifests */
export function validatePublishVisibilityManifests(manifests) {
  for (const m of manifests) {
    const ct = m.canonicalTour;
    const tw = m.tourWrite;
    const hasModule = ct?.publishVisibilityModule !== undefined;
    const hasExport = ct?.publishVisibilityExport !== undefined;
    if (hasModule !== hasExport) {
      throw new Error(
        `workspace.manifest.json ${m.id}: canonicalTour.publishVisibilityModule and publishVisibilityExport must both be set or both omitted`
      );
    }
    if (
      tw !== undefined &&
      ct !== undefined &&
      PUBLISH_VISIBILITY_REQUIRED_WORKSPACES.has(m.id) &&
      !hasModule
    ) {
      throw new Error(
        `workspace.manifest.json ${m.id}: canonicalTour.publishVisibilityModule and publishVisibilityExport are required for publish-golden workspaces with tourWrite`
      );
    }
  }
}

function validatePublishLabelMappingBlock(workspaceId, mapping) {
  if (!Array.isArray(mapping.publishedLabels) || mapping.publishedLabels.length === 0) {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: publishLabelMapping.publishedLabels must be a non-empty array`
    );
  }
  if (!Array.isArray(mapping.notPublishedLabels) || mapping.notPublishedLabels.length === 0) {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: publishLabelMapping.notPublishedLabels must be a non-empty array`
    );
  }
  const publishedSet = new Set(mapping.publishedLabels);
  for (const label of mapping.notPublishedLabels) {
    if (publishedSet.has(label)) {
      throw new Error(
        `workspace.manifest.json ${workspaceId}: publish label "${label}" appears in both publishedLabels and notPublishedLabels`
      );
    }
  }
  const hasArchiveCapability = mapping.archiveCapability === true;
  const optionalArchiveLabels = mapping.optionalArchiveLabels;
  if (optionalArchiveLabels !== undefined && !hasArchiveCapability) {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: publishLabelMapping.optionalArchiveLabels requires archiveCapability: true`
    );
  }
  if (hasArchiveCapability) {
    if (!Array.isArray(optionalArchiveLabels) || optionalArchiveLabels.length === 0) {
      throw new Error(
        `workspace.manifest.json ${workspaceId}: publishLabelMapping.optionalArchiveLabels is required when archiveCapability is true`
      );
    }
    for (const label of optionalArchiveLabels) {
      if (publishedSet.has(label)) {
        throw new Error(
          `workspace.manifest.json ${workspaceId}: archive label "${label}" must not appear in publishedLabels`
        );
      }
    }
  }
}

/** @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>} manifests */
export function validatePublishLabelMappingManifests(manifests) {
  for (const m of manifests) {
    const ct = m.canonicalTour;
    const tw = m.tourWrite;
    const mapping = ct?.publishLabelMapping;
    if (mapping === undefined) {
      if (
        tw !== undefined &&
        ct !== undefined &&
        PUBLISH_LABEL_MAPPING_REQUIRED_WORKSPACES.has(m.id)
      ) {
        throw new Error(
          `workspace.manifest.json ${m.id}: canonicalTour.publishLabelMapping is required for publish-golden workspaces with tourWrite`
        );
      }
      continue;
    }
    validatePublishLabelMappingBlock(m.id, mapping);
  }
}

function serializePublishLabelMapping(mapping) {
  const lines = [
    `    publishedLabels: ${JSON.stringify(mapping.publishedLabels)},`,
    `    notPublishedLabels: ${JSON.stringify(mapping.notPublishedLabels)},`,
  ];
  if (mapping.archiveCapability === true) {
    lines.push(`    archiveCapability: true as const,`);
  }
  if (mapping.optionalArchiveLabels !== undefined) {
    lines.push(`    optionalArchiveLabels: ${JSON.stringify(mapping.optionalArchiveLabels)},`);
  }
  return lines.join("\n");
}

/** @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>} manifests */
export function generatePublishLabelMappings(manifests) {
  validatePublishLabelMappingManifests(manifests);

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const ct = m.canonicalTour;
    const tw = m.tourWrite;
    const mapping = ct?.publishLabelMapping;
    if (mapping === undefined) {
      continue;
    }
    if (tw === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: canonicalTour.publishLabelMapping requires tourWrite.workspaceTypeExport`
      );
    }
    importLines.add(namedImportLine([tw.workspaceTypeExport], m.package));
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    mapping: {
${serializePublishLabelMapping(mapping)}
    },
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_PUBLISH_LABEL_MAPPINGS = [] as const;
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_PUBLISH_LABEL_MAPPINGS = [
${bindingBlocks.join("\n")}
] as const;
`;
}

/** @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>} manifests */
export function generatePublishVisibilityBindings(manifests) {
  validatePublishVisibilityManifests(manifests);

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const ct = m.canonicalTour;
    const tw = m.tourWrite;
    if (ct?.publishVisibilityModule === undefined) {
      continue;
    }
    if (tw === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: canonicalTour.publishVisibilityModule requires tourWrite.workspaceTypeExport`
      );
    }
    const visibilitySpec = importSpecifier(m.package, ct.publishVisibilityModule);
    importLines.add(namedImportLine([ct.publishVisibilityExport], visibilitySpec));
    importLines.add(namedImportLine([tw.workspaceTypeExport], m.package));
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    isTourPubliclyVisible: ${ct.publishVisibilityExport},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_PUBLISH_VISIBILITY_BINDINGS = [] as const;
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_PUBLISH_VISIBILITY_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;
`;
}

/** @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>} manifests */
export function validateTourListProjectionManifests(manifests) {
  for (const m of manifests) {
    const ct = m.canonicalTour;
    const tw = m.tourWrite;
    const hasModule = ct?.tourListProjectionModule !== undefined;
    const hasExport = ct?.tourListProjectionExport !== undefined;
    if (hasModule !== hasExport) {
      throw new Error(
        `workspace.manifest.json ${m.id}: canonicalTour.tourListProjectionModule and tourListProjectionExport must both be set or both omitted`
      );
    }
    if (
      tw !== undefined &&
      ct !== undefined &&
      TOUR_LIST_PROJECTION_REQUIRED_WORKSPACES.has(m.id) &&
      !hasModule
    ) {
      throw new Error(
        `workspace.manifest.json ${m.id}: canonicalTour.tourListProjectionModule and tourListProjectionExport are required for list-projection golden workspaces with tourWrite`
      );
    }
  }
}

/** @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>} manifests */
export function generateTourListProjectionBindings(manifests) {
  validateTourListProjectionManifests(manifests);

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const ct = m.canonicalTour;
    const tw = m.tourWrite;
    if (ct?.tourListProjectionModule === undefined) {
      continue;
    }
    if (tw === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: canonicalTour.tourListProjectionModule requires tourWrite.workspaceTypeExport`
      );
    }
    const projectionSpec = importSpecifier(m.package, ct.tourListProjectionModule);
    importLines.add(namedImportLine([ct.tourListProjectionExport], projectionSpec));
    importLines.add(namedImportLine([tw.workspaceTypeExport], m.package));
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    extractTourListProjection: ${ct.tourListProjectionExport},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_TOUR_LIST_PROJECTION_BINDINGS = [] as const;
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_TOUR_LIST_PROJECTION_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;
`;
}

/** @param {ReturnType<typeof import("../manifest-loader.mjs").discoverManifests>} manifests */
export function generateWebTourListProjectionDispatch(manifests) {
  validateTourListProjectionManifests(manifests);

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const ct = m.canonicalTour;
    const tw = m.tourWrite;
    if (ct?.tourListProjectionModule === undefined) {
      continue;
    }
    if (tw === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: canonicalTour.tourListProjectionModule requires tourWrite.workspaceTypeExport`
      );
    }
    const projectionSpec = importSpecifier(m.package, ct.tourListProjectionModule);
    importLines.add(namedImportLine([ct.tourListProjectionExport], projectionSpec));
    importLines.add(namedImportLine([tw.workspaceTypeExport], m.package));
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    extractTourListProjection: ${ct.tourListProjectionExport},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
import type { CanonicalDocument, TourListProjectionFields } from "@app-tour/workspace-sdk";

export function extractTourListProjectionForWorkspace(
  _workspaceType: string | undefined,
  canonical: CanonicalDocument,
): TourListProjectionFields {
  return Object.freeze({
    title: "Untitled tour",
    shortDescription: null,
    listStatus: "draft",
    uiStatus: "draft",
    priceAmount: null,
    priceCurrency: null,
    totalCapacity: null,
    acceptedCount: 0,
    category: null,
    coverImageUrl: null,
    coverImageStorageKey: null,
    departureAt: null,
  });
}
`;
  }

  return `${BANNER}
import type { CanonicalDocument, TourListProjectionFields } from "@app-tour/workspace-sdk";
${[...importLines].join("\n")}

const WORKSPACE_TOUR_LIST_PROJECTION_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

const bindingsByWorkspaceType = Object.freeze(
  Object.fromEntries(
    WORKSPACE_TOUR_LIST_PROJECTION_BINDINGS.map((binding) => [
      binding.workspaceType as string,
      binding,
    ])
  )
) as Readonly<Record<string, (typeof WORKSPACE_TOUR_LIST_PROJECTION_BINDINGS)[number]>>;

function defaultExtractTourListProjection(canonical: CanonicalDocument): TourListProjectionFields {
  return Object.freeze({
    title: "Untitled tour",
    shortDescription: null,
    listStatus: "draft",
    uiStatus: "draft",
    priceAmount: null,
    priceCurrency: null,
    totalCapacity: null,
    acceptedCount: 0,
    category: null,
    coverImageUrl: null,
    coverImageStorageKey: null,
    departureAt: null,
  });
}

/** CW3-07 — manifest-bound operator tour list projection dispatch for web surfaces. */
export function extractTourListProjectionForWorkspace(
  workspaceType: string | undefined,
  canonical: CanonicalDocument,
): TourListProjectionFields {
  if (workspaceType === undefined) {
    return defaultExtractTourListProjection(canonical);
  }
  const binding = bindingsByWorkspaceType[workspaceType];
  if (binding === undefined) {
    return defaultExtractTourListProjection(canonical);
  }
  return binding.extractTourListProjection(canonical);
}
`;
}

export function generateTourWriteBindings(manifests) {
  const withTourWrite = manifests.filter((m) => m.tourWrite !== undefined);
  if (withTourWrite.length === 0) {
    return `${BANNER}
export const WORKSPACE_TOUR_WRITE_BINDINGS = [] as const;
`;
  }

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of withTourWrite) {
    const tw = m.tourWrite;
    const toursSpec = importSpecifier(m.package, tw.module);
    importLines.add(`import { ${tw.workspaceTypeExport} } from "${m.package}";`);
    importLines.add(
      `import { ${tw.mergeExport}, ${tw.publishGateExport}, ${tw.publishSurfaceExport} } from "${toursSpec}";`
    );
    let assertField = "";
    if (tw.publishOwnerAssertModule !== undefined && tw.publishOwnerAssertExport !== undefined) {
      const assertSpec = importSpecifier(m.package, tw.publishOwnerAssertModule);
      importLines.add(`import { ${tw.publishOwnerAssertExport} } from "${assertSpec}";`);
      assertField = `\n    assertPublishFieldOwner: ${tw.publishOwnerAssertExport},`;
    }
    const memberForbiddenField =
      tw.forbidOperatorMemberTourPatch === true
        ? `\n    forbidOperatorMemberTourPatch: true as const,`
        : "";
    const starterBridgeField =
      typeof tw.starterCreateBridgeOperatorTenantId === "string"
        ? `\n    starterCreateBridgeOperatorTenantId: ${JSON.stringify(tw.starterCreateBridgeOperatorTenantId)} as const,`
        : "";
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    mergeCanonicalPatch: ${tw.mergeExport},
    publishFieldGate: ${tw.publishGateExport},
    publishOwnerSurface: ${tw.publishSurfaceExport},${assertField}${memberForbiddenField}${starterBridgeField}
  },`);
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_TOUR_WRITE_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;
`;
}

export function generateOutboxSideEffects(manifests) {
  /** @type {{ workspaceTypes: string[]; eventType: string; export: string; importSpecifier: string }[]} */
  const rows = [];
  /** @type {Map<string, Set<string>>} */
  const importsBySpecifier = new Map();
  /** @type {Map<string, Set<string>>} */
  const reexportsBySpecifier = new Map();

  for (const m of manifests) {
    if (!Array.isArray(m.events) || m.events.length === 0) continue;
    for (const ev of m.events) {
      const hostSideEffect = ev.hostSideEffect;
      if (hostSideEffect === undefined) {
        throw new Error(
          `workspace.manifest.json ${m.id} event ${ev.eventType}: hostSideEffect is required (adapterModule + export)`
        );
      }
      if (
        typeof hostSideEffect.adapterModule !== "string" ||
        typeof hostSideEffect.export !== "string"
      ) {
        throw new Error(
          `workspace.manifest.json ${m.id} event ${ev.eventType}: hostSideEffect.adapterModule and export are required`
        );
      }
      if (
        hostSideEffect.dispatchVia !== undefined &&
        hostSideEffect.dispatchVia !== "financeEventReaction"
      ) {
        throw new Error(
          `workspace.manifest.json ${m.id} event ${ev.eventType}: hostSideEffect.dispatchVia must be "financeEventReaction" when set`
        );
      }
      const workspaceTypes = ev.workspaceTypes ?? m.workspaceTypes;
      const spec = importSpecifier(m.package, hostSideEffect.adapterModule);
      const routeViaFinanceReaction = hostSideEffect.dispatchVia === "financeEventReaction";

      // Phase 1.9 Event Ownership Closure: financeEventReaction is owned by the finance
      // reaction registry + workspace package — never re-exported from platform outbox codegen.
      if (routeViaFinanceReaction) {
        continue;
      }

      if (!importsBySpecifier.has(spec)) {
        importsBySpecifier.set(spec, new Set());
      }
      importsBySpecifier.get(spec).add(hostSideEffect.export);

      if (!reexportsBySpecifier.has(spec)) {
        reexportsBySpecifier.set(spec, new Set());
      }
      reexportsBySpecifier.get(spec).add(hostSideEffect.export);
      if (typeof hostSideEffect.registerExport === "string") {
        reexportsBySpecifier.get(spec).add(hostSideEffect.registerExport);
      }
      if (typeof hostSideEffect.rowTypeExport === "string") {
        reexportsBySpecifier.get(spec).add(`type ${hostSideEffect.rowTypeExport}`);
      }

      rows.push({
        workspaceTypes,
        eventType: ev.eventType,
        export: hostSideEffect.export,
        importSpecifier: spec,
      });
    }
  }

  const reexportLines = [...reexportsBySpecifier.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([spec, exports]) => {
      return `export { ${[...exports].sort((a, b) => a.localeCompare(b)).join(", ")} } from "${spec}";`;
    });

  if (rows.length === 0) {
    const reexportBlock = reexportLines.length > 0 ? `\n${reexportLines.join("\n")}\n` : "";
    const empty = `${BANNER}
import type { WorkspaceOutboxPublishedRow } from "./workspace-outbox-row-context";

export type WorkspaceOutboxSideEffectRunner = (
  row: WorkspaceOutboxPublishedRow
) => Promise<void | boolean>;

/** Non–financeEventReaction host side effects only. Finance TourCreated uses the reaction registry. */
export const WORKSPACE_OUTBOX_SIDE_EFFECT_BINDINGS: readonly {
  readonly workspaceTypes: readonly string[];
  readonly eventType: string;
  readonly run: WorkspaceOutboxSideEffectRunner;
}[] = [];
${reexportBlock}`;
    assertNoDuplicateEmittedSymbols(empty, "generateOutboxSideEffects");
    return empty;
  }

  const importLines = [...importsBySpecifier.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([spec, exports]) => {
      return `import { ${[...exports].sort((a, b) => a.localeCompare(b)).join(", ")} } from "${spec}";`;
    });

  const bindingBlocks = rows.map(
    (row) => `  {
    workspaceTypes: ${JSON.stringify(row.workspaceTypes)},
    eventType: ${JSON.stringify(row.eventType)},
    run: ${row.export},
  },`
  );

  const populated = `${BANNER}
import type { WorkspaceOutboxPublishedRow } from "./workspace-outbox-row-context";
${importLines.join("\n")}

export type WorkspaceOutboxSideEffectRunner = (
  row: WorkspaceOutboxPublishedRow
) => Promise<void | boolean>;

export const WORKSPACE_OUTBOX_SIDE_EFFECT_BINDINGS: readonly {
  readonly workspaceTypes: readonly string[];
  readonly eventType: string;
  readonly run: WorkspaceOutboxSideEffectRunner;
}[] = [
${bindingBlocks.join("\n")}
];

${reexportLines.join("\n")}
`;
  assertNoDuplicateEmittedSymbols(populated, "generateOutboxSideEffects");
  return populated;
}

export function generateCatalogRefAllowlistResolvers(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const ct = m.canonicalTour;
    const tw = m.tourWrite;
    if (ct?.catalogRefEnrichment !== true || tw === undefined) {
      continue;
    }
    if (m.id !== "denali") {
      throw new Error(
        `workspace.manifest.json ${m.id}: catalogRefEnrichment resolver not registered in tour-api codegen`
      );
    }
    importLines.add(`import { ${tw.workspaceTypeExport} } from "${m.package}";`);
    importLines.add(
      `import { resolveDenaliCatalogRefAllowlists } from "../canonical/resolve-denali-catalog-ref-allowlists.ts";`
    );
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    resolve: resolveDenaliCatalogRefAllowlists,
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_CATALOG_REF_ALLOWLIST_RESOLVERS = [] as const;

export async function resolveCatalogRefAllowlistsForWorkspaceBinding(
  _workspaceType: string,
  _tenantId: string
) {
  return undefined;
}
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}
import type { CatalogRefAllowlists } from "../canonical/assert-catalog-ref-integrity.ts";

export const WORKSPACE_CATALOG_REF_ALLOWLIST_RESOLVERS = [
${bindingBlocks.join("\n")}
] as const;

export async function resolveCatalogRefAllowlistsForWorkspaceBinding(
  workspaceType: string,
  tenantId: string
): Promise<CatalogRefAllowlists | undefined> {
  const binding = WORKSPACE_CATALOG_REF_ALLOWLIST_RESOLVERS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  if (binding === undefined) {
    return undefined;
  }
  return binding.resolve(tenantId);
}
`;
}

export function generateApiWizardRulesBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const wr = m.wizardRules;
    const tw = m.tourWrite;
    if (wr === undefined || tw === undefined) {
      continue;
    }
    if (typeof wr.module !== "string" || typeof wr.export !== "string") {
      throw new Error(`workspace.manifest.json ${m.id}: wizardRules requires module and export`);
    }
    const alias = `${m.id.replace(/-/g, "_")}_wizard_rules`;
    const spec = importSpecifier(m.package, wr.module);
    importLines.add(`import { ${tw.workspaceTypeExport} } from "${m.package}";`);
    importLines.add(`import { ${wr.export} as ${alias} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    rulesModule: Object.freeze({
      evaluateFormFieldRule: ${alias}.evaluateFormFieldRule,
      applyDenaliInvariantState: ${alias}.applyDenaliInvariantState,
      resolveDenaliRuleSetFromTemplate: ${alias}.resolveDenaliRuleSetFromTemplate,
      buildDefaultForm: ${alias}.buildDenaliTourCreateDefaultValues,
      readCanonicalBasics: ${alias}.readDenaliCanonicalBasics,
      canonicalToFormPathMap: ${alias}.canonicalToFormPathMap,
      tourKindValues: ${alias}.tourKindValues,
    }),
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export function getWizardRulesModuleSyncForWorkspace(_workspaceType: string): never {
  throw new Error("No wizard rules module registered for workspace");
}
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}

export type WorkspaceWizardRulesModuleSync = (typeof WORKSPACE_WIZARD_RULES_BINDINGS)[number]["rulesModule"];

export const WORKSPACE_WIZARD_RULES_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

const rulesByWorkspaceType = Object.freeze(
  Object.fromEntries(
    WORKSPACE_WIZARD_RULES_BINDINGS.map((binding) => [
      binding.workspaceType as string,
      binding.rulesModule,
    ])
  )
) as Readonly<Record<string, WorkspaceWizardRulesModuleSync>>;

export function getWizardRulesModuleSyncForWorkspace(
  workspaceType: string
): WorkspaceWizardRulesModuleSync {
  const rules = rulesByWorkspaceType[workspaceType];
  if (rules === undefined) {
    throw new Error(\`No wizard rules module for workspace: \${workspaceType}\`);
  }
  return rules;
}
`;
}
