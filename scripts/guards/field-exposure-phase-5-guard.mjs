#!/usr/bin/env node
/**
 * Field Exposure System — Phase 5 generic exposure UI ownership closure guard.
 *
 * @see docs/architecture/field-exposure-system.md#phase-5--generic-exposure-ui
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const ARCHITECTURE_README = join(REPO_ROOT, "docs/architecture/README.md");
const CHECKLIST_COMPONENT = join(REPO_ROOT, "apps/web/src/exposure/ExposureFieldChecklist.tsx");
const SELECTION_LOGIC = join(REPO_ROOT, "apps/web/src/exposure/exposure-field-selection.ts");
const SELECTION_LOGIC_SPEC = join(REPO_ROOT, "apps/web/test/exposure-field-selection.spec.ts");
const CHECKLIST_DOM_SPEC = join(REPO_ROOT, "apps/web/test/exposure-field-checklist.spec.tsx");
const PHASE_5_CONTRACT = join(
  REPO_ROOT,
  "apps/web/test/field-exposure-phase-5-ui.contract.spec.ts"
);
const PANEL = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx"
);

const REQUIRED_DOC_MARKERS = [
  "## Phase 5 — Generic Exposure UI",
  "exposure-field-selection.ts",
  "resolveExposureChecklistContext",
  "guard:field-exposure-phase-5",
  "exposure-field-selection.spec.ts",
  "exposure-field-checklist.spec.tsx",
  "field-exposure-phase-5-ui.contract.spec.ts",
];

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function main() {
  const failures = [];

  const exposureDoc = readText(EXPOSURE_DOC);
  if (!exposureDoc?.includes("Phase 5 complete")) {
    failures.push("field-exposure-system.md must mark Phase 5 complete");
  }
  for (const marker of REQUIRED_DOC_MARKERS) {
    if (!exposureDoc?.includes(marker)) {
      failures.push(`field-exposure-system.md missing Phase 5 marker: ${marker}`);
    }
  }
  const phase5Start = exposureDoc?.indexOf("## Phase 5 — Generic Exposure UI") ?? -1;
  const phase5End =
    exposureDoc?.indexOf("## Phase 6 — Dual-Write + Controlled Cutover", phase5Start) ?? -1;
  if (phase5Start >= 0 && phase5End > phase5Start) {
    const phase5Section = exposureDoc.slice(phase5Start, phase5End);
    if (/^- \[ \]/m.test(phase5Section)) {
      failures.push("Phase 5 checklist has unchecked items");
    }
  } else {
    failures.push("Phase 5 section boundaries not found in field-exposure-system.md");
  }

  const readme = readText(ARCHITECTURE_README);
  if (!readme?.includes("guard:field-exposure-phase-5")) {
    failures.push("docs/architecture/README.md must reference guard:field-exposure-phase-5");
  }

  for (const path of [
    CHECKLIST_COMPONENT,
    SELECTION_LOGIC,
    SELECTION_LOGIC_SPEC,
    CHECKLIST_DOM_SPEC,
    PHASE_5_CONTRACT,
    PANEL,
  ]) {
    if (!existsSync(path)) {
      failures.push(`missing ${path.replace(`${REPO_ROOT}/`, "")}`);
    }
  }

  const checklist = readText(CHECKLIST_COMPONENT);
  if (!checklist?.includes("export function ExposureFieldChecklist")) {
    failures.push("ExposureFieldChecklist must export the reusable component");
  }
  if (checklist?.includes("@/integrations")) {
    failures.push("ExposureFieldChecklist must not import integration modules");
  }
  if (checklist?.includes("patchIntegration")) {
    failures.push("ExposureFieldChecklist must not call integration patch APIs");
  }
  for (const dataAttr of ["data-surface", "data-audience", "data-trigger"]) {
    if (!checklist?.includes(dataAttr)) {
      failures.push(`ExposureFieldChecklist must expose ${dataAttr}`);
    }
  }

  const logic = readText(SELECTION_LOGIC);
  if (logic?.includes("import")) {
    // pure logic must not depend on React or integrations
    if (/from\s+["']react["']/.test(logic) || logic.includes("@/integrations")) {
      failures.push("exposure-field-selection.ts must be free of React/integration imports");
    }
  }
  for (const fn of [
    "resolveExposureChecklistContext",
    "resolveExposureIntentContextFromPersisted",
    "resolveExposureIntentPatchInput",
    "resolveEffectiveSelectedFieldIds",
    "toggleExposureFieldSelection",
    "setExposureCustomizeFields",
    "resolveExposureSelectionSaveInput",
    "toExposureChecklistFields",
    "resolveExposureFieldSelectionFromPersisted",
    "catalogFieldIdsFromExposureFields",
  ]) {
    if (!logic?.includes(`export function ${fn}`)) {
      failures.push(`exposure-field-selection.ts must export ${fn}`);
    }
  }

  const panel = readText(PANEL);
  if (!panel?.includes("ExposureFieldChecklist")) {
    failures.push("integration panel must embed ExposureFieldChecklist");
  }
  if (!panel?.includes("resolveExposureIntentContextFromPersisted")) {
    failures.push(
      "integration panel must hydrate exposure context from persisted intent + connection provider",
    );
  }
  if (!panel?.includes("resolveExposureIntentPatchInput")) {
    failures.push(
      "integration panel must build full exposure intent PATCH body through exposure helpers",
    );
  }
  if (!panel?.includes("connection.provider")) {
    failures.push("integration panel must source default surface from connection.provider");
  }
  if (/context=\{\{\s*surface:\s*["']telegram["']/.test(panel ?? "")) {
    failures.push("integration panel must not hardcode surface: \"telegram\"");
  }
  if (!panel?.includes("customizeFieldsLabel")) {
    failures.push("integration panel must render the inherit/override (customize) toggle");
  }
  if (!panel?.includes("exposureCandidateFields")) {
    failures.push("integration panel must source catalog from exposureCandidateFields");
  }
  if (!panel?.includes("toExposureChecklistFields")) {
    failures.push("integration panel must map catalog fields through exposure checklist mapper");
  }
  if (!panel?.includes("resolveExposureFieldSelectionFromPersisted")) {
    failures.push("integration panel must hydrate selection state from exposure helpers");
  }
  if (panel?.includes("IntegrationDeliveryCandidateFieldMeta")) {
    failures.push("integration panel must not depend on integration catalog field meta type");
  }
  if (panel?.includes("deliveryCandidateFields")) {
    failures.push("integration panel must not depend on deliveryCandidateFields");
  }

  if (failures.length > 0) {
    console.error("field-exposure-phase-5-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("field-exposure-phase-5-guard: PASS");
}

main();
