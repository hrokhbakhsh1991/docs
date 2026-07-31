import { BANNER } from "../constants.mjs";
import { assertNoDuplicateEmittedSymbols, importSpecifier } from "../utils.mjs";

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
      throw new Error(`workspace.manifest.json ${m.id}: canonicalTour requires tourWrite.workspaceTypeExport`);
    }
    importLines.add(`import { ${tw.workspaceTypeExport} } from "${m.package}";`);
    const publishSpec = importSpecifier(m.package, ct.publishStatusModule);
    importLines.add(
      `import { ${ct.publishStatusReadExport}, ${ct.publishTransitionExport} } from "${publishSpec}";`
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
          ct.wrapLegacyExport,
        );
        migrateSurfaceFields = `
    legacySoTRoot: ${ct.legacySoTRootExport},
    currentSchemaVersion: ${ct.currentSchemaVersionExport},
    legacySchemaVersion: ${ct.legacySchemaVersionExport},
    wrapLegacyCanonical: ${ct.wrapLegacyExport},`;
      }
      importLines.add(`import { ${migrateImports.join(", ")} } from "${migrateSpec}";`);
      migrateField = `\n    migrateCanonical: ${ct.migrateExport},${migrateSurfaceFields}`;
    }
    let formProfileGhostPathsField = "";
    if (ct.formProfileGhostPathsModule !== undefined && ct.formProfileGhostPathsExport !== undefined) {
      const ghostSpec = importSpecifier(m.package, ct.formProfileGhostPathsModule);
      importLines.add(`import { ${ct.formProfileGhostPathsExport} } from "${ghostSpec}";`);
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
