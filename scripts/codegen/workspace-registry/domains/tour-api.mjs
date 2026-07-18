import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

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
      importLines.add(`import { ${ct.migrateExport} } from "${migrateSpec}";`);
      migrateField = `\n    migrateCanonical: ${ct.migrateExport},`;
    }
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    readPublishStatusFromCanonical: ${ct.publishStatusReadExport},
    detectPublishTransition: ${ct.publishTransitionExport},${migrateField}
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
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    mergeCanonicalPatch: ${tw.mergeExport},
    publishFieldGate: ${tw.publishGateExport},
    publishOwnerSurface: ${tw.publishSurfaceExport},${assertField}${memberForbiddenField}
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

      // Re-exports keep register/run symbols for adapter IO injection + backward-compat tests.
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

      // Phase 1.8: financeEventReaction is dispatched via finance registry — not binding.run.
      if (routeViaFinanceReaction) {
        continue;
      }

      if (!importsBySpecifier.has(spec)) {
        importsBySpecifier.set(spec, new Set());
      }
      importsBySpecifier.get(spec).add(hostSideEffect.export);
      rows.push({
        workspaceTypes,
        eventType: ev.eventType,
        export: hostSideEffect.export,
        importSpecifier: spec,
      });
    }
  }

  const reexportLines = [...reexportsBySpecifier.entries()].map(([spec, exports]) => {
    return `export { ${[...exports].sort((a, b) => a.localeCompare(b)).join(", ")} } from "${spec}";`;
  });

  if (rows.length === 0) {
    const reexportBlock = reexportLines.length > 0 ? `\n${reexportLines.join("\n")}\n` : "";
    return `${BANNER}
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
  }

  const importLines = [...importsBySpecifier.entries()].map(([spec, exports]) => {
    return `import { ${[...exports].sort().join(", ")} } from "${spec}";`;
  });

  const bindingBlocks = rows.map(
    (row) => `  {
    workspaceTypes: ${JSON.stringify(row.workspaceTypes)},
    eventType: ${JSON.stringify(row.eventType)},
    run: ${row.export},
  },`
  );

  return `${BANNER}
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
`;
}
