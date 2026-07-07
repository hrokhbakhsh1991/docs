/**
 * Phase H3 — workspace production certification guard logic (pure / testable).
 * @see docs/dev/workspace-certification.mdoc
 */
import fs from "node:fs";
import path from "node:path";

/** @typedef {"pass" | "partial"} ProofStatus */

export const CERT_IDS = ["CERT-01", "CERT-02", "CERT-03", "CERT-04", "CERT-05"];

const E2E_HOOK_ID_SPEC_RE =
  /- id: ([^\n]+)\n(?:.*\n)*?    spec: ([^\n]+)/g;

/**
 * @param {string} generatedSource
 * @returns {Record<string, "stub" | "certified">}
 */
export function parseProductionCertificationFromGenerated(generatedSource) {
  /** @type {Record<string, "stub" | "certified">} */
  const out = {};
  for (const match of generatedSource.matchAll(/"([^"]+)": "(stub|certified)"/g)) {
    out[match[1]] = /** @type {"stub" | "certified"} */ (match[2]);
  }
  return out;
}

/**
 * Minimal YAML parser for workspace-certification-proof-matrix.yaml.
 * @param {string} raw
 */
export function parseProofMatrixYaml(raw) {
  /** @type {Record<string, { proofs: Record<string, unknown> }>} */
  const plugins = {};
  let currentPlugin = null;
  let currentCert = null;
  let inHookIds = false;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const pluginMatch = line.match(/^  ([a-z0-9-]+):$/);
    if (pluginMatch) {
      currentPlugin = pluginMatch[1];
      plugins[currentPlugin] = { proofs: {} };
      currentCert = null;
      inHookIds = false;
      continue;
    }

    if (!currentPlugin) continue;

    const proofsHeader = trimmed === "proofs:";
    if (proofsHeader) continue;

    const certSimple = line.match(/^      (CERT-\d+): (pass|partial)$/);
    if (certSimple) {
      currentCert = certSimple[1];
      plugins[currentPlugin].proofs[currentCert] = certSimple[2];
      inHookIds = false;
      continue;
    }

    const certBlock = line.match(/^      (CERT-\d+):$/);
    if (certBlock) {
      currentCert = certBlock[1];
      plugins[currentPlugin].proofs[currentCert] = {};
      inHookIds = false;
      continue;
    }

    if (!currentCert) continue;

    const statusLine = trimmed.match(/^status: (pass|partial)$/);
    if (statusLine) {
      const entry = plugins[currentPlugin].proofs[currentCert];
      if (typeof entry === "object" && entry !== null) {
        entry.status = statusLine[1];
      }
      continue;
    }

    const runbookLine = trimmed.match(/^runbook: (.+)$/);
    if (runbookLine) {
      const entry = plugins[currentPlugin].proofs[currentCert];
      if (typeof entry === "object" && entry !== null) {
        entry.runbook = runbookLine[1].trim();
      }
      continue;
    }

    if (trimmed === "hookIds:") {
      inHookIds = true;
      const entry = plugins[currentPlugin].proofs[currentCert];
      if (typeof entry === "object" && entry !== null) {
        entry.hookIds = [];
      }
      continue;
    }

    const hookId = trimmed.match(/^- (.+)$/);
    if (hookId && inHookIds) {
      const entry = plugins[currentPlugin].proofs[currentCert];
      if (typeof entry === "object" && entry !== null && Array.isArray(entry.hookIds)) {
        entry.hookIds.push(hookId[1].trim());
      }
    }
  }

  return { plugins };
}

/**
 * @param {unknown} proof
 * @returns {ProofStatus | null}
 */
export function proofStatusOf(proof) {
  if (proof === "pass" || proof === "partial") return proof;
  if (typeof proof === "object" && proof !== null && "status" in proof) {
    const status = /** @type {{ status?: string }} */ (proof).status;
    if (status === "pass" || status === "partial") return status;
  }
  return null;
}

/**
 * @param {string} e2eHooksRaw
 * @returns {Map<string, string>}
 */
export function parseE2eHookSpecs(e2eHooksRaw) {
  /** @type {Map<string, string>} */
  const hooks = new Map();
  for (const match of e2eHooksRaw.matchAll(E2E_HOOK_ID_SPEC_RE)) {
    hooks.set(match[1].trim(), match[2].trim());
  }
  return hooks;
}

/**
 * @param {{
 *   manifestTiers: Record<string, "stub" | "certified">;
 *   generatedTiers: Record<string, "stub" | "certified">;
 *   proofMatrix: ReturnType<typeof parseProofMatrixYaml>;
 *   e2eHooksRaw: string;
 *   repoRoot: string;
 * }} input
 * @returns {string[]}
 */
export function collectCertificationViolations(input) {
  const { manifestTiers, generatedTiers, proofMatrix, e2eHooksRaw, repoRoot } = input;
  /** @type {string[]} */
  const violations = [];
  const hookSpecs = parseE2eHookSpecs(e2eHooksRaw);

  const manifestIds = Object.keys(manifestTiers).sort();
  const generatedIds = Object.keys(generatedTiers).sort();
  if (manifestIds.join(",") !== generatedIds.join(",")) {
    violations.push(
      `CERT-04: manifest plugin ids [${manifestIds.join(", ")}] != generated [${generatedIds.join(", ")}]`
    );
  }

  for (const pluginId of manifestIds) {
    const manifestTier = manifestTiers[pluginId];
    const generatedTier = generatedTiers[pluginId];
    if (manifestTier !== generatedTier) {
      violations.push(
        `CERT-04: ${pluginId} manifest tier ${manifestTier} != generated ${generatedTier ?? "missing"}`
      );
    }
  }

  for (const [pluginId, tier] of Object.entries(generatedTiers)) {
    if (tier !== "certified") {
      if (proofMatrix.plugins[pluginId]) {
        violations.push(`${pluginId}: stub plugin must not declare proofs in proof matrix`);
      }
      continue;
    }

    const entry = proofMatrix.plugins[pluginId];
    if (!entry) {
      violations.push(`${pluginId}: certified plugin missing from proof matrix`);
      continue;
    }

    for (const certId of CERT_IDS) {
      const proof = entry.proofs[certId];
      if (proof === undefined) {
        violations.push(`${pluginId}: missing ${certId} in proof matrix`);
        continue;
      }

      const status = proofStatusOf(proof);
      if (!status) {
        violations.push(`${pluginId}: ${certId} must declare pass or partial`);
        continue;
      }

      if (certId !== "CERT-05" && status !== "pass") {
        violations.push(`${pluginId}: ${certId} must be pass (got ${status})`);
      }

      if (certId === "CERT-03") {
        if (status !== "pass") {
          violations.push(`${pluginId}: CERT-03 must be pass for certified workspaces`);
          continue;
        }
        const hookIds =
          typeof proof === "object" && proof !== null && "hookIds" in proof
            ? /** @type {{ hookIds?: string[] }} */ (proof).hookIds ?? []
            : [];
        if (hookIds.length === 0) {
          violations.push(`${pluginId}: CERT-03 requires hookIds`);
          continue;
        }
        for (const hookId of hookIds) {
          const specRel = hookSpecs.get(hookId);
          if (!specRel) {
            violations.push(`${pluginId}: CERT-03 hook ${hookId} missing from guest-registration-e2e-hooks.yaml`);
            continue;
          }
          const specPath = path.join(repoRoot, specRel);
          if (!fs.existsSync(specPath)) {
            violations.push(`${pluginId}: CERT-03 spec missing for ${hookId} at ${specRel}`);
          }
        }
      }

      if (certId === "CERT-05") {
        const runbook =
          typeof proof === "object" && proof !== null && "runbook" in proof
            ? /** @type {{ runbook?: string }} */ (proof).runbook
            : undefined;
        if (!runbook) {
          violations.push(`${pluginId}: CERT-05 requires runbook path when declared`);
          continue;
        }
        const runbookPath = path.join(repoRoot, runbook);
        if (!fs.existsSync(runbookPath)) {
          violations.push(`${pluginId}: CERT-05 runbook missing at ${runbook}`);
        }
      }
    }
  }

  return violations;
}
