#!/usr/bin/env node
/**
 * Field Exposure System — Phase 0 freeze guard (strict closure).
 *
 * - Architecture doc sections, checklist, and inventory completeness
 * - Inventory owner file paths exist on disk
 * - Transitional allowlist parsed from doc (single source of truth)
 * - Blocks NEW integration-owned field-selection outside allowlist (staged diff)
 *
 * @see docs/architecture/field-exposure-system.md#phase-0--freeze-and-inventory
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const FIELD_POLICY_DOC = join(REPO_ROOT, "docs/architecture/field-policy-system.md");
const INTEGRATION_DOC = join(
  REPO_ROOT,
  "docs/dev/workspace-integration-plugin-system.mdoc"
);
const ARCHITECTURE_README = join(REPO_ROOT, "docs/architecture/README.md");

const REQUIRED_DOC_SECTIONS = [
  "## Purpose",
  "## Boundary Contract",
  "## Domain Model (ADR)",
  "## Evaluation Pipeline",
  "## Enterprise Invariants",
  "## Transitional Concepts Inventory",
  "### Transitional code allowlist",
  "## Phase 0 — Freeze and Inventory",
  "## Denali and Telegram Compatibility Criteria",
  "## Migration Phases",
  "## Forbidden Core Concepts (final state)",
  "## Success Criteria (end-state)",
];

const MIN_INVENTORY_ROWS = 15;

const REQUIRED_INVENTORY_CONCEPTS = [
  "IntegrationDeliveryIntent",
  "selectedFieldIds",
  "deliveryCandidateFields",
  "exposureCandidateFields",
  "buildDeliveryFieldCatalog",
  'surface: "delivery"',
  "deliverable",
  "legacy-telegram:",
  "exposure_intents",
  "ExposureFieldChecklist",
  "FIELD_EXPOSURE_RUNTIME_MODE",
  "deliveryCandidateFieldIds",
];

const FORBIDDEN_NEW_FEATURE_PATTERNS = [
  {
    label: "integration-owned catalog builder",
    pattern: /\bbuildDeliverySelectableFieldCatalog\b/,
  },
  {
    label: "integration delivery intent as new platform primitive",
    pattern: /\bIntegrationDeliveryIntent\b/,
  },
  {
    label: "deliveryCandidateFields as primary catalog API",
    pattern: /\bdeliveryCandidateFields\b/,
  },
  {
    label: "integration delivery intent patch in new surface",
    pattern: /\bpatchIntegrationDeliveryIntent\b/,
  },
];

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function parseAllowlistFromDoc(text) {
  const marker = "### Transitional code allowlist";
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const fenceStart = text.indexOf("```text", start);
  if (fenceStart < 0) return null;
  const contentStart = fenceStart + "```text".length;
  const fenceEnd = text.indexOf("```", contentStart);
  if (fenceEnd < 0) return null;
  return text
    .slice(contentStart, fenceEnd)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function countInventoryRows(text) {
  const start = text.indexOf("## Transitional Concepts Inventory");
  const end = text.indexOf("### Transitional code allowlist", start);
  if (start < 0 || end < 0) return 0;
  const section = text.slice(start, end);
  return section
    .split("\n")
    .filter(
      (line) =>
        line.startsWith("| ") &&
        !line.includes("Concept |") &&
        !line.startsWith("|---")
    )
    .length;
}

function extractInventoryOwnerPaths(text) {
  const start = text.indexOf("## Transitional Concepts Inventory");
  const end = text.indexOf("### Transitional code allowlist", start);
  if (start < 0 || end < 0) return [];
  const section = text.slice(start, end);
  const paths = new Set();
  const pattern = /`(apps\/[^`]+|packages\/[^`]+)`/g;
  let match;
  while ((match = pattern.exec(section)) !== null) {
    const raw = match[1].replace(/\/$/, "");
    if (raw.includes("(") || raw.includes("**")) continue;
    paths.add(raw);
  }
  return [...paths];
}

function pathExists(repoRelativePath) {
  const full = join(REPO_ROOT, repoRelativePath);
  return existsSync(full);
}

function isTransitionalPath(filePath, allowlist) {
  return allowlist.some(
    (prefix) => filePath === prefix.replace(/\/$/, "") || filePath.startsWith(prefix)
  );
}

function evaluateDocClosure() {
  const failures = [];
  const text = readText(EXPOSURE_DOC);
  if (!text) {
    failures.push("missing docs/architecture/field-exposure-system.md");
    return { failures, allowlist: [] };
  }

  if (!/Phase 0 complete/i.test(text)) {
    failures.push("field-exposure-system.md status must mark Phase 0 complete");
  }

  for (const section of REQUIRED_DOC_SECTIONS) {
    if (!text.includes(section)) {
      failures.push(`field-exposure-system.md missing section: ${section}`);
    }
  }

  const unchecked = text.match(/^- \[ \]/m);
  if (unchecked) {
    failures.push("Phase 0 checklist has unchecked items");
  }

  const inventoryRows = countInventoryRows(text);
  if (inventoryRows < MIN_INVENTORY_ROWS) {
    failures.push(
      `transitional inventory must have at least ${MIN_INVENTORY_ROWS} concept rows (found ${inventoryRows})`
    );
  }

  for (const concept of REQUIRED_INVENTORY_CONCEPTS) {
    if (!text.includes(concept)) {
      failures.push(`transitional inventory missing concept: ${concept}`);
    }
  }

  const ownerPaths = extractInventoryOwnerPaths(text);
  for (const ownerPath of ownerPaths) {
    if (!pathExists(ownerPath)) {
      failures.push(`inventory owner path missing on disk: ${ownerPath}`);
    }
  }

  const allowlist = parseAllowlistFromDoc(text);
  if (!allowlist || allowlist.length < 8) {
    failures.push("transitional code allowlist missing or too short in architecture doc");
  } else {
    for (const prefix of allowlist) {
      const probe = join(REPO_ROOT, prefix);
      if (!existsSync(probe)) {
        failures.push(`allowlist path missing on disk: ${prefix}`);
      }
    }
  }

  if (!existsSync(ARCHITECTURE_README)) {
    failures.push("missing docs/architecture/README.md index");
  } else {
    const readme = readText(ARCHITECTURE_README);
    if (!readme?.includes("field-exposure-system.md")) {
      failures.push("docs/architecture/README.md must link field-exposure-system.md");
    }
  }

  const fieldPolicy = readText(FIELD_POLICY_DOC);
  if (!fieldPolicy?.includes("field-exposure-system.md")) {
    failures.push("field-policy-system.md must link to field-exposure-system.md");
  }
  if (!fieldPolicy?.includes("Field Exposure System")) {
    failures.push("field-policy-system.md must name Field Exposure System boundary");
  }
  if (!fieldPolicy?.includes("guard:field-exposure-phase-0")) {
    failures.push("field-policy-system.md must reference guard:field-exposure-phase-0");
  }
  if (!fieldPolicy?.includes("Do not add new features")) {
    failures.push(
      "field-policy-system.md must forbid new integration-owned field selection features"
    );
  }

  const integrationDoc = readText(INTEGRATION_DOC);
  if (!integrationDoc?.includes("field-exposure-system.md")) {
    failures.push(
      "workspace-integration-plugin-system.mdoc must link to field-exposure-system.md"
    );
  }
  if (!integrationDoc?.includes("transitional")) {
    failures.push(
      "workspace-integration-plugin-system.mdoc must mark field selection as transitional"
    );
  }
  if (!integrationDoc?.includes("guard:field-exposure-phase-0")) {
    failures.push(
      "workspace-integration-plugin-system.mdoc must reference guard:field-exposure-phase-0"
    );
  }

  return { failures, allowlist: allowlist ?? [] };
}

function listStagedAddedFiles() {
  const result = spawnSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=A"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  if (result.status !== 0) return [];
  return (result.stdout || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => /\.(ts|tsx|md|mdoc)$/.test(file));
}

function evaluateNewIntegrationOwnedSelection(allowlist) {
  const failures = [];
  const added = listStagedAddedFiles();
  if (added.length === 0) return failures;

  for (const file of added) {
    if (isTransitionalPath(file, allowlist)) continue;
    const fullPath = join(REPO_ROOT, file);
    if (!existsSync(fullPath)) continue;
    if (!statSync(fullPath).isFile()) continue;
    const text = readFileSync(fullPath, "utf8");
    for (const { label, pattern } of FORBIDDEN_NEW_FEATURE_PATTERNS) {
      if (pattern.test(text)) {
        failures.push(
          `${file}: new file outside transitional allowlist uses ${label}`
        );
      }
    }
  }

  return failures;
}

function main() {
  const { failures: docFailures, allowlist } = evaluateDocClosure();
  const failures = [
    ...docFailures,
    ...evaluateNewIntegrationOwnedSelection(allowlist),
  ];

  if (failures.length > 0) {
    console.error("field-exposure-phase-0-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    `field-exposure-phase-0-guard: PASS (inventory rows >= ${MIN_INVENTORY_ROWS}, allowlist ${allowlist.length} paths)`
  );
}

main();
