#!/usr/bin/env node
/**
 * Field Exposure System — Phase 1 domain language closure guard.
 *
 * Validates glossary, ADRs, legacy mapping, forbidden vocabulary, and cross-doc mirrors.
 * The post-closure staged "no runtime code" ratchet is retired (see Phase 1 doc section).
 *
 * @see docs/architecture/field-exposure-system.md#phase-1--domain-language-closure
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
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
const PHASE_1_CONTRACT = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-1-language.contract.spec.ts"
);

const REQUIRED_DOC_SECTIONS = [
  "## Glossary",
  "## Architecture Decision Records (Phase 1)",
  "## Legacy → Exposure Vocabulary Mapping",
  "## Forbidden and Transitional Vocabulary",
  "## Phase 1 — Domain Language Closure",
];

const REQUIRED_GLOSSARY_TERMS = [
  "ExposureSurface",
  "Audience",
  "ActivationTrigger",
  "FieldExposurePolicy",
  "ExposureProfile",
  "ExposureIntent",
  "ExposureContext",
  "ExposureDecision",
  "ExposureResolver",
];

const REQUIRED_ADRS = [
  "ADR-FE-001",
  "ADR-FE-002",
  "ADR-FE-003",
  "ADR-FE-004",
  "ADR-FE-005",
];

const REQUIRED_LEGACY_MAPPINGS = [
  "IntegrationDeliveryIntent",
  "deliveryCandidateFields",
  "deliverable",
  'surface: "delivery"',
  "legacy-telegram:",
  "buildDeliveryFieldCatalog",
  "messageTemplates",
  "IntegrationEventPolicy.enabled",
];

const REQUIRED_FORBIDDEN_TERMS = [
  "IntegrationDeliveryIntent",
  "deliveryCandidateFields",
  "deliverable",
  'surface: "delivery"',
];

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function evaluateExposureDoc() {
  const failures = [];
  const text = readText(EXPOSURE_DOC);
  if (!text) {
    failures.push("missing docs/architecture/field-exposure-system.md");
    return failures;
  }

  if (!/Phase 1 complete/i.test(text)) {
    failures.push("field-exposure-system.md status must mark Phase 1 complete");
  }

  for (const section of REQUIRED_DOC_SECTIONS) {
    if (!text.includes(section)) {
      failures.push(`field-exposure-system.md missing section: ${section}`);
    }
  }

  const phase1Unchecked = text.includes("## Phase 1 — Domain Language Closure")
    ? text
        .slice(text.indexOf("## Phase 1 — Domain Language Closure"))
        .split("## Denali and Telegram Compatibility Criteria")[0]
        ?.match(/^- \[ \]/m)
    : null;
  if (phase1Unchecked) {
    failures.push("Phase 1 checklist has unchecked items");
  }

  for (const term of REQUIRED_GLOSSARY_TERMS) {
    const rowPattern = new RegExp(`\\| \`${term}\` \\|`);
    if (!rowPattern.test(text)) {
      failures.push(`glossary missing term row: ${term}`);
    }
  }

  for (const adr of REQUIRED_ADRS) {
    if (!text.includes(adr)) {
      failures.push(`missing ADR: ${adr}`);
    }
  }

  const mappingStart = text.indexOf("## Legacy → Exposure Vocabulary Mapping");
  const mappingEnd = text.indexOf("## Forbidden and Transitional Vocabulary", mappingStart);
  if (mappingStart < 0 || mappingEnd < 0) {
    failures.push("legacy mapping section boundaries not found");
  } else {
    const mappingSection = text.slice(mappingStart, mappingEnd);
    for (const legacy of REQUIRED_LEGACY_MAPPINGS) {
      if (!mappingSection.includes(legacy)) {
        failures.push(`legacy mapping missing row for: ${legacy}`);
      }
    }
  }

  const forbiddenStart = text.indexOf("## Forbidden and Transitional Vocabulary");
  const forbiddenEnd = text.indexOf("## Evaluation Pipeline", forbiddenStart);
  const forbiddenSection =
    forbiddenStart >= 0
      ? text.slice(
          forbiddenStart,
          forbiddenEnd > forbiddenStart ? forbiddenEnd : text.length
        )
      : "";
  for (const term of REQUIRED_FORBIDDEN_TERMS) {
    if (!forbiddenSection.includes(term)) {
      failures.push(`forbidden vocabulary missing term: ${term}`);
    }
  }

  if (!text.includes("guard:field-exposure-phase-1")) {
    failures.push("field-exposure-system.md must reference guard:field-exposure-phase-1");
  }

  return failures;
}

function evaluateSiblingDocs() {
  const failures = [];

  const readme = readText(ARCHITECTURE_README);
  if (!readme?.includes("Phase 1 complete")) {
    failures.push("docs/architecture/README.md must mark Phase 1 complete");
  }
  if (!readme?.includes("guard:field-exposure-phase-1")) {
    failures.push("docs/architecture/README.md must reference guard:field-exposure-phase-1");
  }

  const fieldPolicy = readText(FIELD_POLICY_DOC);
  if (!fieldPolicy?.includes("guard:field-exposure-phase-1")) {
    failures.push("field-policy-system.md must reference guard:field-exposure-phase-1");
  }
  if (!fieldPolicy?.includes("legacy eligibility filter")) {
    failures.push(
      "field-policy-system.md must state delivery surface is legacy eligibility filter only"
    );
  }
  if (!fieldPolicy?.includes("ExposureSurface")) {
    failures.push("field-policy-system.md must mirror ExposureSurface vocabulary");
  }

  const integrationDoc = readText(INTEGRATION_DOC);
  if (!integrationDoc?.includes("guard:field-exposure-phase-1")) {
    failures.push(
      "workspace-integration-plugin-system.mdoc must reference guard:field-exposure-phase-1"
    );
  }
  if (!integrationDoc?.includes("do not own field catalogs")) {
    failures.push(
      "workspace-integration-plugin-system.mdoc must state integrations do not own field catalogs"
    );
  }

  if (!existsSync(PHASE_1_CONTRACT)) {
    failures.push("missing apps/api/test/field-exposure-phase-1-language.contract.spec.ts");
  }

  return failures;
}

function evaluatePhase1Scope() {
  // Retired after Phase 1 documentation closure (2026-06-28). A staged-diff "no runtime
  // .ts/.tsx" ratchet made sense only while Phase 1 PRs were docs/guards/contracts-only.
  // Post-closure, product PRs routinely stage apps/web and workspace runtime while API
  // field-exposure contract tests still invoke this guard — failing those PRs is a false
  // positive. Glossary / ADR / sibling-doc checks above remain the live Phase 1 contract.
  return [];
}

function main() {
  const failures = [
    ...evaluateExposureDoc(),
    ...evaluateSiblingDocs(),
    ...evaluatePhase1Scope(),
  ];

  if (failures.length > 0) {
    console.error("field-exposure-phase-1-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    `field-exposure-phase-1-guard: PASS (glossary ${REQUIRED_GLOSSARY_TERMS.length} terms, ADRs ${REQUIRED_ADRS.length})`
  );
}

main();
