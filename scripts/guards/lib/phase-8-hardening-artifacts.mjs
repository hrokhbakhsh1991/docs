#!/usr/bin/env node
/**
 * Phase 8.1 — hardening artifact presence and formatting integrity.
 * @see docs/phase-8/appendices/PHASE-BOUNDARY-MATRIX.yaml
 * @see docs/phase-8/appendices/schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

const FAIL_PREFIX = "FAIL P8-GUARD-HARDENING-ARTIFACTS:";

/** Charter gate count — must match phase-8-guard.mjs report and IMPLEMENTATION-TRUTH attestation. */
export const PHASE8_CHARTER_GATES = 24;

export const SPEC_REGISTRY_REL = "docs/phase-8/appendices/SPEC-REGISTRY-8.1.yaml";

/**
 * Canonical 8.1 anti-hollow API spec scaffolds (exact paths).
 * @type {readonly string[]}
 */
export const REQUIRED_PHASE8_8_1_API_SPECS = Object.freeze([
  "apps/api/test/urban-owner-ability.spec.ts",
  "apps/api/test/urban-settings-patch.spec.ts",
  "apps/api/test/urban-redis-fallback.spec.ts",
  "apps/api/test/urban-tours-bypass-gate.spec.ts",
]);

/**
 * Full 8.1 spec registry — API + SDK + web scaffolds (6 paths).
 * @type {readonly string[]}
 */
export const REQUIRED_PHASE8_8_1_SPEC_REGISTRY = Object.freeze([
  ...REQUIRED_PHASE8_8_1_API_SPECS,
  "packages/workspace-sdk/test/urban-owner-ability.spec.ts",
  "apps/web/test/urban-owner-access.spec.ts",
]);

/**
 * Hardening YAML contracts enforced by p8_hardening_artifacts (also in PEK register).
 * @type {readonly string[]}
 */
export const REQUIRED_PHASE8_HARDENING_YAML = Object.freeze([
  "docs/phase-8/appendices/schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml",
  "docs/phase-8/appendices/PHASE-BOUNDARY-MATRIX.yaml",
]);

/** @type {readonly { re: RegExp; label: string }[]} */
const FORBIDDEN_ELLIPSIS_PATTERNS = Object.freeze([
  { re: /\{\.\.\.\}/, label: "{...}" },
  { re: /z\.object\(\{\.\.\.\}\)/, label: "z.object({...})" },
  { re: /^\s*\.\.\.\s*$/m, label: "standalone ... line" },
]);

/**
 * @param {string} rel
 * @returns {Promise<string>}
 */
async function readRepoFile(rel) {
  const abs = path.join(REPO_ROOT, rel);
  try {
    return await fs.readFile(abs, "utf8");
  } catch (cause) {
    const err = cause instanceof Error ? cause : new Error(String(cause));
    throw new Error(`${FAIL_PREFIX} Cannot read ${rel}: ${err.message}`);
  }
}

/**
 * @param {string} rel
 * @param {string} content
 * @returns {string | null}
 */
function findForbiddenEllipsis(rel, content) {
  for (const { re, label } of FORBIDDEN_ELLIPSIS_PATTERNS) {
    if (re.test(content)) {
      return `${rel} contains forbidden ellipsis token ${label}`;
    }
  }
  return null;
}

/**
 * @param {string} rel
 * @param {string} content
 * @returns {string | null}
 */
function validateHardeningYaml(rel, content) {
  const ellipsis = findForbiddenEllipsis(rel, content);
  if (ellipsis) {
    return ellipsis;
  }
  if (!/^contract_id:\s/m.test(content)) {
    return `${rel} missing contract_id root key`;
  }
  if (!/^version:\s/m.test(content)) {
    return `${rel} missing version root key`;
  }
  if (rel.endsWith("URBAN-SETTINGS-HTTP-ENVELOPE.yaml")) {
    if (!/response_envelope:/m.test(content)) {
      return `${rel} missing response_envelope block`;
    }
    if (!/success:/m.test(content) || !/^\s+data:/m.test(content) || !/^\s+metadata:/m.test(content)) {
      return `${rel} missing success/data/metadata envelope keys`;
    }
  }
  if (rel.endsWith("PHASE-BOUNDARY-MATRIX.yaml")) {
    if (!/action_on_violation:\s*REJECT_PR_IMMEDIATELY/m.test(content)) {
      return `${rel} missing action_on_violation: REJECT_PR_IMMEDIATELY`;
    }
    if (!/catalog_scope_metadata_mapping:/m.test(content)) {
      return `${rel} missing catalog_scope_metadata_mapping block`;
    }
  }
  return null;
}

/**
 * @param {string} rel
 * @param {string} content
 * @param {{ minBytes?: number }} [options]
 * @returns {string | null}
 */
function validateSpecScaffold(rel, content, options = {}) {
  const minBytes = options.minBytes ?? 400;
  const ellipsis = findForbiddenEllipsis(rel, content);
  if (ellipsis) {
    return ellipsis;
  }
  if (!/from\s+["']node:test["']/.test(content)) {
    return `${rel} must import node:test runner`;
  }
  if (!/\bdescribe\s*\(/.test(content)) {
    return `${rel} missing describe() block`;
  }
  if (!/\bit\s*\(/.test(content)) {
    return `${rel} missing it() block`;
  }
  if (!/\bexpect\s*\(/.test(content)) {
    return `${rel} missing expect() assertion stub`;
  }
  if (!/\.toBe\s*\(/.test(content)) {
    return `${rel} missing .toBe() concrete assertion`;
  }
  if (content.trim().length < minBytes) {
    return `${rel} below minimum scaffold size (hollow file)`;
  }
  return null;
}

/**
 * @param {string} rel
 * @param {string} content
 * @returns {string | null}
 */
function validateApiSpecScaffold(rel, content) {
  const base = validateSpecScaffold(rel, content, { minBytes: 400 });
  if (base) {
    return base;
  }
  if (rel.endsWith("urban-settings-patch.spec.ts")) {
    if (!/success/.test(content) || !/data\?\.urban|data\.urban/.test(content)) {
      return `${rel} ASM-8.1-001 must assert GET envelope success/data.urban per DEC-P8-003`;
    }
    for (const key of ["correlationId", "primaryColor", "featureFlags", "rateLimitRps"]) {
      if (!content.includes(key)) {
        return `${rel} ASM-001 must assert metadata.${key} per DEC-P8-003 envelope depth`;
      }
    }
  }
  return null;
}

/**
 * DEC-P8-003 — GET envelope vs PATCH bare urban doc consistency.
 * @returns {Promise<void>}
 */
export async function verifyEnvelopeConsistency() {
  const mergeRel = "docs/phase-8/appendices/URBAN-THEME-MERGE-ALGORITHM.md";
  const caslRel = "docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md";
  const decisionsRel = "docs/phase-8/appendices/IMPLEMENTATION-DECISIONS.md";
  const dispatchRel = "docs/phase-8/appendices/urban-api-dispatch-addendum.md";

  const merge = await readRepoFile(mergeRel);
  const casl = await readRepoFile(caslRel);
  const decisions = await readRepoFile(decisionsRel);
  const dispatch = await readRepoFile(dispatchRel);

  if (!decisions.includes("DEC-P8-003")) {
    throw new Error(`${FAIL_PREFIX} ${decisionsRel} missing DEC-P8-003`);
  }
  if (!merge.includes("URBAN-SETTINGS-HTTP-ENVELOPE.yaml")) {
    throw new Error(`${FAIL_PREFIX} ${mergeRel} must cite URBAN-SETTINGS-HTTP-ENVELOPE.yaml for GET`);
  }
  if (/GET\s+\/urban\/settings 200 body := \{ urban:/m.test(merge)) {
    throw new Error(
      `${FAIL_PREFIX} ${mergeRel} forbids bare { urban } on GET — use envelope per DEC-P8-003`,
    );
  }
  if (!casl.includes("URBAN-SETTINGS-HTTP-ENVELOPE.yaml")) {
    throw new Error(`${FAIL_PREFIX} ${caslRel} must cite URBAN-SETTINGS-HTTP-ENVELOPE.yaml`);
  }
  if (!casl.includes("handleGetUrbanSettings")) {
    throw new Error(`${FAIL_PREFIX} ${caslRel} missing handleGetUrbanSettings template`);
  }
  if (!dispatch.includes("DEC-P8-003")) {
    throw new Error(`${FAIL_PREFIX} ${dispatchRel} missing DEC-P8-003 response table`);
  }
  if (!dispatch.includes("success: true")) {
    throw new Error(`${FAIL_PREFIX} ${dispatchRel} GET excerpt must use success/data/metadata envelope`);
  }
}

/**
 * Block C — doc path anti-drift: canonical spec filenames and flat urban/** boundary.
 * @returns {Promise<void>}
 */
export async function verifyDocPathConsistency() {
  const staleSpecPath = /urban-settings-owner\.spec\.ts/;
  const canonicalSettingsSpec = "apps/api/test/urban-settings-patch.spec.ts";
  const phase8Root = path.join(REPO_ROOT, "docs/phase-8");
  /** @type {string[]} */
  const staleHits = [];

  /**
   * @param {string} dir
   */
  async function walkPhase8Docs(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walkPhase8Docs(abs);
        continue;
      }
      if (!ent.isFile()) {
        continue;
      }
      const ext = path.extname(ent.name).toLowerCase();
      if (ext !== ".md" && ext !== ".yaml") {
        continue;
      }
      const content = await fs.readFile(abs, "utf8");
      if (staleSpecPath.test(content)) {
        const rel = path.relative(REPO_ROOT, abs).split(path.sep).join("/");
        staleHits.push(rel);
      }
    }
  }

  await walkPhase8Docs(phase8Root);

  if (staleHits.length > 0) {
    throw new Error(
      `${FAIL_PREFIX} Stale spec path urban-settings-owner.spec.ts in docs/phase-8: ${staleHits.join(", ")} — use urban-settings-patch.spec.ts`,
    );
  }

  const bootRel = "docs/phase-8/appendices/BOOT-MANIFEST.yaml";
  const boot = await readRepoFile(bootRel);
  if (!boot.includes(canonicalSettingsSpec)) {
    throw new Error(
      `${FAIL_PREFIX} ${bootRel} prove_with must cite ${canonicalSettingsSpec}`,
    );
  }

  const boundaryRel = "docs/phase-8/appendices/PHASE-BOUNDARY-MATRIX.yaml";
  const boundary = await readRepoFile(boundaryRel);
  if (/apps\/api\/src\/urban\/auth\/\*\*/.test(boundary)) {
    throw new Error(
      `${FAIL_PREFIX} ${boundaryRel} must use flat apps/api/src/urban/** — not urban/auth/**`,
    );
  }
  if (!/apps\/api\/src\/urban\/\*\*/.test(boundary)) {
    throw new Error(
      `${FAIL_PREFIX} ${boundaryRel} rules.allowed_write_paths missing apps/api/src/urban/**`,
    );
  }
}

/**
 * Block E — CASL spec must not use hollow TenantAuthz ellipsis; full method surface required.
 * @returns {Promise<void>}
 */
export async function verifyCaslNoEllipsis() {
  const caslRel = "docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md";
  const content = await readRepoFile(caslRel);

  /** @type {readonly { re: RegExp; label: string }[]} */
  const forbiddenCaslPatterns = Object.freeze([
    { re: /\/\/\s*…\s*existing methods\s*…/, label: "TenantAuthz // … existing methods … comment" },
    { re: /\/\/\s*\.\.\.\s*existing methods\s*\.\.\./, label: "TenantAuthz // ... existing methods ... comment" },
    { re: /existing methods\s*…/, label: "existing methods ellipsis suffix" },
  ]);

  for (const { re, label } of forbiddenCaslPatterns) {
    if (re.test(content)) {
      throw new Error(`${FAIL_PREFIX} ${caslRel} contains forbidden CASL ellipsis: ${label}`);
    }
  }

  /** @type {readonly string[]} */
  const requiredTenantAuthzMethods = Object.freeze([
    "canReadWorkspace",
    "canUpdateWorkspace",
    "canReadTenant",
    "canManageTenant",
    "canReadPlugin",
    "canInstallPlugin",
    "canAccessWorkspaceTheme",
    "canReadCanonicalDocument",
    "canCreateCanonicalDocument",
    "canUpdateCanonicalDocument",
    "canPerformUrbanOwnerMutation",
  ]);

  for (const method of requiredTenantAuthzMethods) {
    if (!content.includes(method)) {
      throw new Error(
        `${FAIL_PREFIX} ${caslRel} TenantAuthz contract missing method ${method}`,
      );
    }
  }

  if (!/export type UrbanOwnerSurface/m.test(content)) {
    throw new Error(`${FAIL_PREFIX} ${caslRel} missing UrbanOwnerSurface enum block`);
  }
}

/**
 * @param {string} yamlContent
 * @returns {string[]}
 */
function parseYamlSpecList(yamlContent) {
  const match = yamlContent.match(/^specs:\n((?:[ \t]+-\s+.+\n)+)/m);
  if (!match) {
    return [];
  }
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

/**
 * Sprint J — ASM-001 metadata depth in urban-settings-patch.spec.ts.
 * @returns {Promise<void>}
 */
export async function verifyEnvelopeSpecDepth() {
  const rel = "apps/api/test/urban-settings-patch.spec.ts";
  const content = await readRepoFile(rel);
  /** @type {readonly string[]} */
  const metadataKeys = Object.freeze([
    "correlationId",
    "primaryColor",
    "featureFlags",
    "rateLimitRps",
  ]);
  for (const key of metadataKeys) {
    if (!content.includes(key)) {
      throw new Error(
        `${FAIL_PREFIX} ${rel} ASM-001 must assert metadata.${key} per DEC-P8-003`,
      );
    }
  }
}

/**
 * Sprint L — entry ledger scaffold present; PENDING honest until phase-7:gate exit 0.
 * @returns {Promise<void>}
 */
export async function verifyEntryLedgerPresent() {
  const rel = "reports/phase-8-entry-verified.yaml";
  let content;
  try {
    content = await readRepoFile(rel);
  } catch {
    throw new Error(`${FAIL_PREFIX} missing ${rel} — scaffold per 8.0-entry.md Sprint L`);
  }

  for (const key of ["ledger_version:", "phase_7_gate:", "map_22_reviewed:"]) {
    if (!content.includes(key)) {
      throw new Error(`${FAIL_PREFIX} ${rel} missing required key ${key.replace(":", "")}`);
    }
  }

  const statusMatch = /phase_7_gate:[\s\S]*?status:\s*(PENDING|PASS)/m.exec(content);
  if (!statusMatch) {
    throw new Error(`${FAIL_PREFIX} ${rel} phase_7_gate.status must be PENDING or PASS`);
  }

  if (statusMatch[1] === "PASS" && !/exit_code:\s*0\b/.test(content)) {
    throw new Error(
      `${FAIL_PREFIX} ${rel} forbids phase_7_gate.status PASS without exit_code: 0`,
    );
  }
}

/**
 * Sprint F — truth/guards attestation must match PHASE8_CHARTER_GATES (no stale 9/9).
 * @returns {Promise<void>}
 */
export async function verifyTruthAttestationSync() {
  const truthRel = "docs/phase-8/audits/IMPLEMENTATION-TRUTH.md";
  const truth = await readRepoFile(truthRel);

  if (/\b9\/9 PASS\b/.test(truth)) {
    throw new Error(`${FAIL_PREFIX} stale 9/9 attestation in ${truthRel}`);
  }
  if (/charter_gates:\s*(9|10|11|12|13|14|15|16|17|18|19|20|21|22|23)\b/.test(truth)) {
    throw new Error(`${FAIL_PREFIX} stale charter_gates count in ${truthRel} — must be ${PHASE8_CHARTER_GATES}`);
  }
  if (!truth.includes(`charter_gates: ${PHASE8_CHARTER_GATES}`)) {
    throw new Error(
      `${FAIL_PREFIX} ${truthRel} must cite charter_gates: ${PHASE8_CHARTER_GATES}`,
    );
  }
  if (!truth.includes(`${PHASE8_CHARTER_GATES}/${PHASE8_CHARTER_GATES}`)) {
    throw new Error(
      `${FAIL_PREFIX} ${truthRel} attestation must cite ${PHASE8_CHARTER_GATES}/${PHASE8_CHARTER_GATES} PASS`,
    );
  }
}

/**
 * Sprint G — SPEC-REGISTRY-8.1.yaml parity with guard registry and prove_with consumers.
 * @returns {Promise<void>}
 */
export async function verifyProveWithParity() {
  const registryContent = await readRepoFile(SPEC_REGISTRY_REL);
  const registrySpecs = parseYamlSpecList(registryContent);
  const expected = [...REQUIRED_PHASE8_8_1_SPEC_REGISTRY].sort();
  const actual = [...registrySpecs].sort();

  if (registrySpecs.length === 0) {
    throw new Error(`${FAIL_PREFIX} ${SPEC_REGISTRY_REL} missing specs: list`);
  }
  if (expected.length !== actual.length || expected.some((p, i) => p !== actual[i])) {
    throw new Error(
      `${FAIL_PREFIX} ${SPEC_REGISTRY_REL} specs mismatch guard registry — expected ${expected.join(", ")} got ${actual.join(", ")}`,
    );
  }

  const boot = await readRepoFile("docs/phase-8/appendices/BOOT-MANIFEST.yaml");
  const boot81 = boot.slice(boot.indexOf('"8.1":'), boot.indexOf('"8.2":'));
  for (const spec of registrySpecs) {
    if (!boot81.includes(spec)) {
      throw new Error(`${FAIL_PREFIX} BOOT-MANIFEST 8.1 prove_with missing ${spec}`);
    }
  }

  const sub81 = await readRepoFile("docs/phase-8/subphases/8.1-single-owner-auth.md");
  const subFront = sub81.slice(0, sub81.indexOf("---", sub81.indexOf("---") + 3));
  for (const spec of registrySpecs) {
    if (!subFront.includes(spec)) {
      throw new Error(`${FAIL_PREFIX} 8.1 subphase completion_proof missing ${spec}`);
    }
  }

  const truth = await readRepoFile("docs/phase-8/audits/IMPLEMENTATION-TRUTH.md");
  const proveBlock = truth.slice(
    truth.indexOf("prove_with_implementation:"),
    truth.indexOf("```", truth.indexOf("prove_with_implementation:") + 1),
  );
  for (const spec of registrySpecs) {
    if (!proveBlock.includes(spec)) {
      throw new Error(`${FAIL_PREFIX} IMPLEMENTATION-TRUTH prove_with_implementation missing ${spec}`);
    }
  }

  const matrix = await readRepoFile("docs/phase-8/audits/verification-matrix.md");
  const bundle81 = matrix.slice(
    matrix.indexOf("### 8.1 Single-Owner auth"),
    matrix.indexOf("### 8.2 Urban product port"),
  );
  for (const spec of registrySpecs) {
    const base = path.basename(spec);
    if (!bundle81.includes(base)) {
      throw new Error(`${FAIL_PREFIX} verification-matrix 8.1 bundle missing ${base}`);
    }
  }
}

/**
 * Sprint H — CASL API surface alignment across specs, router, decisions.
 * @returns {Promise<void>}
 */
export async function verifyApiSurfaceAlignment() {
  const sdkSpec = await readRepoFile(
    "packages/workspace-sdk/test/urban-owner-ability.spec.ts",
  );
  if (!/authz\.canPerformUrbanOwnerMutation\s*\(/.test(sdkSpec)) {
    throw new Error(
      `${FAIL_PREFIX} SDK spec must call authz.canPerformUrbanOwnerMutation (TenantAuthz method per DEC-P8-004)`,
    );
  }
  if (/import[\s\S]*canPerformUrbanOwnerMutation[\s\S]*tenant-authz/.test(sdkSpec)) {
    throw new Error(
      `${FAIL_PREFIX} SDK spec must not import canPerformUrbanOwnerMutation as standalone export`,
    );
  }
  if (!sdkSpec.includes("tenant-auth-grants")) {
    throw new Error(`${FAIL_PREFIX} SDK spec must import isWorkspaceOwner from tenant-auth-grants.js`);
  }
  if (/isWorkspaceOwner\s*\(\s*authz\s*\)/.test(sdkSpec)) {
    throw new Error(`${FAIL_PREFIX} isWorkspaceOwner takes TenantAuthContext not TenantAuthz`);
  }

  const router = await readRepoFile("docs/phase-8/phase-8-agent-router.md");
  if (/wizard-access\*\.ts.*\|\s*\*\*8\.1\*\*/.test(router)) {
    throw new Error(`${FAIL_PREFIX} router must not list wizard-access*.ts as 8.1 write target`);
  }
  if (!router.includes("urban-settings-access.ts")) {
    throw new Error(`${FAIL_PREFIX} router must cite apps/web/src/urban/urban-settings-access.ts for 8.1`);
  }

  const matrix = await readRepoFile("docs/phase-8/audits/verification-matrix.md");
  if (/assertUrbanOwner/.test(matrix)) {
    throw new Error(`${FAIL_PREFIX} verification-matrix must use assertWorkspaceOwner not assertUrbanOwner`);
  }

  const decisions = await readRepoFile("docs/phase-8/appendices/IMPLEMENTATION-DECISIONS.md");
  if (!decisions.includes("DEC-P8-004")) {
    throw new Error(`${FAIL_PREFIX} IMPLEMENTATION-DECISIONS.md missing DEC-P8-004`);
  }
}

/**
 * Block D — 8.1 spec path registry (API + SDK + web).
 * @returns {Promise<void>}
 */
export async function verifySpecPathRegistry() {
  /** @type {string[]} */
  const missing = [];

  for (const rel of REQUIRED_PHASE8_8_1_SPEC_REGISTRY) {
    const abs = path.join(REPO_ROOT, rel);
    try {
      const st = await fs.stat(abs);
      if (!st.isFile()) {
        missing.push(`${rel} (not a file)`);
      }
    } catch (cause) {
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT") {
        missing.push(rel);
      } else {
        const err = cause instanceof Error ? cause : new Error(String(cause));
        throw new Error(`${FAIL_PREFIX} Cannot stat ${rel}: ${err.message}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `${FAIL_PREFIX} Missing 8.1 spec registry path(s): ${missing.join(", ")}`,
    );
  }

  for (const rel of REQUIRED_PHASE8_8_1_SPEC_REGISTRY) {
    const content = await readRepoFile(rel);
    const minBytes = rel.startsWith("apps/api/") ? 400 : 300;
    const specError = validateSpecScaffold(rel, content, { minBytes });
    if (specError) {
      throw new Error(`${FAIL_PREFIX} ${specError}`);
    }
    if (rel.endsWith("urban-settings-patch.spec.ts")) {
      const patchError = validateApiSpecScaffold(rel, content);
      if (patchError) {
        throw new Error(`${FAIL_PREFIX} ${patchError}`);
      }
    }
    if (rel.endsWith("packages/workspace-sdk/test/urban-owner-ability.spec.ts")) {
      if (!/SDK-8\.1-0[1-8]/.test(content)) {
        throw new Error(`${FAIL_PREFIX} ${rel} must declare SDK-8.1-01..08 case IDs`);
      }
    }
    if (rel.endsWith("apps/web/test/urban-owner-access.spec.ts")) {
      if (!/WEB-8\.1-0[1-5]/.test(content)) {
        throw new Error(`${FAIL_PREFIX} ${rel} must declare WEB-8.1-01..05 case IDs`);
      }
    }
  }

  if (REQUIRED_PHASE8_8_1_SPEC_REGISTRY.length !== 6) {
    throw new Error(
      `${FAIL_PREFIX} Internal invariant violated: expected 6 registry specs, got ${REQUIRED_PHASE8_8_1_SPEC_REGISTRY.length}`,
    );
  }
}

/**
 * @returns {Promise<void>}
 */
export async function verifyHardeningArtifacts() {
  /** @type {string[]} */
  const missing = [];

  for (const rel of [...REQUIRED_PHASE8_HARDENING_YAML, ...REQUIRED_PHASE8_8_1_API_SPECS]) {
    const abs = path.join(REPO_ROOT, rel);
    try {
      const st = await fs.stat(abs);
      if (!st.isFile()) {
        missing.push(`${rel} (not a file)`);
      }
    } catch (cause) {
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT") {
        missing.push(rel);
      } else {
        const err = cause instanceof Error ? cause : new Error(String(cause));
        throw new Error(`${FAIL_PREFIX} Cannot stat ${rel}: ${err.message}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `${FAIL_PREFIX} Missing hardening artifact(s): ${missing.join(", ")}`,
    );
  }

  for (const rel of REQUIRED_PHASE8_HARDENING_YAML) {
    const content = await readRepoFile(rel);
    const yamlError = validateHardeningYaml(rel, content);
    if (yamlError) {
      throw new Error(`${FAIL_PREFIX} ${yamlError}`);
    }
  }

  for (const rel of REQUIRED_PHASE8_8_1_API_SPECS) {
    const content = await readRepoFile(rel);
    const specError = validateApiSpecScaffold(rel, content);
    if (specError) {
      throw new Error(`${FAIL_PREFIX} ${specError}`);
    }
  }

  const expectedTotal =
    REQUIRED_PHASE8_HARDENING_YAML.length + REQUIRED_PHASE8_8_1_API_SPECS.length;
  if (expectedTotal !== 6) {
    throw new Error(
      `${FAIL_PREFIX} Internal invariant violated: expected 6 hardening artifacts, got ${expectedTotal}`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await verifyHardeningArtifacts();
    console.log(
      `phase-8-hardening-artifacts: PASS (${REQUIRED_PHASE8_HARDENING_YAML.length} YAML + ${REQUIRED_PHASE8_8_1_API_SPECS.length} API specs)`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
