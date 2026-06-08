#!/usr/bin/env node
/**
 * Phase 8 — PEK file presence hardening (doc execution system target >= 96).
 * @see docs/phase-8/appendices/PRECISION-DOC-INDEX.md
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

const FAIL_PREFIX = "FAIL P8-GUARD-HARDENING:";

/**
 * Canonical Phase 8 PEK corpus — exactly 39 required files (relative to repo root).
 * @type {readonly string[]}
 */
export const REQUIRED_PHASE8_PEK_FILES = Object.freeze([
  "docs/phase-8/AGENT-NAVIGATOR.md",
  "docs/phase-8/phase-8-agent-router.md",
  "docs/phase-8/phase-8-charter.md",
  "docs/phase-8/phase-8-guards.md",
  "docs/phase-8/appendices/AGENT-CURRENT-PHASE.yaml",
  "docs/phase-8/appendices/BOOT-MANIFEST.yaml",
  "docs/phase-8/appendices/adr-008.md",
  "docs/phase-8/appendices/IMPLEMENTATION-DECISIONS.md",
  "docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md",
  "docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md",
  "docs/phase-8/appendices/URBAN-PRODUCT-SCOPE.md",
  "docs/phase-8/appendices/SMOKE-SCENARIO-MAP.md",
  "docs/phase-8/appendices/PRECISION-DOC-INDEX.md",
  "docs/phase-8/appendices/phase-7-bridge.md",
  "docs/phase-8/appendices/verification-commands.md",
  "docs/phase-8/appendices/env-runtime-matrix.md",
  "docs/phase-8/appendices/action-registry.md",
  "docs/phase-8/appendices/PHASE-BOUNDARY-MATRIX.yaml",
  "docs/phase-8/appendices/AGENT-STATE-MAP-8.1.yaml",
  "docs/phase-8/appendices/TRACEABILITY-MATRIX-8.1.md",
  "docs/phase-8/appendices/urban-api-dispatch-addendum.md",
  "docs/phase-8/appendices/URBAN-THEME-MERGE-ALGORITHM.md",
  "docs/phase-8/appendices/TOURS-PUBLISH-FIELD-GATE.md",
  "docs/phase-8/appendices/CANLOAD-URBAN-SETTINGS.contract.ts",
  "docs/phase-8/appendices/schemas/URBAN-THEME-JSONB.schema.json",
  "docs/phase-8/appendices/schemas/URBAN-SETTINGS-PATCH.zod.ts",
  "docs/phase-8/appendices/SPEC-REGISTRY-8.1.yaml",
  "docs/phase-8/appendices/schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml",
  "docs/phase-8/appendices/erip/README.md",
  "docs/phase-8/appendices/erip/8.1-cop-auth-isolation.md",
  "docs/phase-8/audits/DOC-EXECUTION-SCORECARD.md",
  "docs/phase-8/audits/IMPLEMENTATION-TRUTH.md",
  "docs/phase-8/audits/verification-matrix.md",
  "docs/phase-8/subphases/8.0-entry.md",
  "docs/phase-8/subphases/8.1-single-owner-auth.md",
  "docs/phase-8/subphases/8.2-urban-features.md",
  "docs/phase-8/subphases/8.3-silo-tier.md",
  "docs/phase-8/subphases/8.4-e2e-integrity.md",
  "docs/phase-8/subphases/8.5-platform-dod.md",
]);

/**
 * @param {string} corpusPath — absolute or repo-relative path to `docs/phase-8`
 * @returns {Promise<void>}
 */
export async function verifyDocHardening(corpusPath) {
  if (typeof corpusPath !== "string" || corpusPath.trim().length === 0) {
    throw new Error(`${FAIL_PREFIX} corpusPath must be a non-empty string`);
  }

  const resolvedCorpus = path.isAbsolute(corpusPath)
    ? path.normalize(corpusPath)
    : path.normalize(path.join(REPO_ROOT, corpusPath));

  let corpusStat;
  try {
    corpusStat = await fs.stat(resolvedCorpus);
  } catch (cause) {
    const err = cause instanceof Error ? cause : new Error(String(cause));
    throw new Error(
      `${FAIL_PREFIX} Corpus directory not accessible at ${resolvedCorpus}: ${err.message}`
    );
  }

  if (!corpusStat.isDirectory()) {
    throw new Error(`${FAIL_PREFIX} corpusPath is not a directory: ${resolvedCorpus}`);
  }

  const expectedCorpus = path.normalize(path.join(REPO_ROOT, "docs/phase-8"));
  if (resolvedCorpus !== expectedCorpus) {
    throw new Error(
      `${FAIL_PREFIX} corpusPath must resolve to docs/phase-8 (got ${resolvedCorpus})`
    );
  }

  const routerPath = path.join(resolvedCorpus, "phase-8-agent-router.md");
  try {
    await fs.access(routerPath);
  } catch {
    throw new Error(
      `${FAIL_PREFIX} Corpus missing sole entry marker phase-8-agent-router.md at ${routerPath}`
    );
  }

  /** @type {string[]} */
  const missing = [];

  for (const rel of REQUIRED_PHASE8_PEK_FILES) {
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
    const detail = missing.map((p) => `Missing required PEK file at ${p}`).join("; ");
    throw new Error(`${FAIL_PREFIX} ${detail}`);
  }

  if (REQUIRED_PHASE8_PEK_FILES.length !== 39) {
    throw new Error(
      `${FAIL_PREFIX} Internal invariant violated: expected 39 PEK paths, got ${REQUIRED_PHASE8_PEK_FILES.length}`
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const corpusArg = process.argv[2] ?? "docs/phase-8";
  try {
    await verifyDocHardening(corpusArg);
    console.log(
      `phase-8-doc-hardening: PASS (${REQUIRED_PHASE8_PEK_FILES.length} PEK files present)`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
