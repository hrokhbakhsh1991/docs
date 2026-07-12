/**
 * Phase H3 — workspace certification guard unit tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  discoverManifests,
  generateWorkspaceProductionCertification,
  resolveProductionCertificationTier,
} from "../generate-workspace-registry.mjs";
import {
  collectCertificationViolations,
  collectOperatorCapabilitiesViolations,
  parseOperatorCapabilitiesFromGenerated,
  parseProductionCertificationFromGenerated,
  parseProofMatrixYaml,
  proofStatusOf,
} from "../guards/lib/workspace-certification-guard.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROOF_MATRIX = join(REPO_ROOT, "docs/dev/workspace-certification-proof-matrix.yaml");
const GENERATED = join(
  REPO_ROOT,
  "packages/workspace-sdk/src/catalog/workspace-production-certification.generated.ts"
);
const OPERATOR_CAPS = join(
  REPO_ROOT,
  "packages/workspace-sdk/src/operator/workspace-operator-capabilities.generated.ts"
);
const E2E_HOOKS = join(REPO_ROOT, "docs/dev/guest-registration-e2e-hooks.yaml");

describe("workspace certification guard (Phase H3)", () => {
  it("parses generated certification registry", () => {
    const generated = readFileSync(GENERATED, "utf8");
    const tiers = parseProductionCertificationFromGenerated(generated);
    assert.equal(tiers.denali, "certified");
    assert.equal(tiers.urban, "stub");
    assert.equal(tiers["guest-club"], "stub");
    assert.equal(tiers.starter, "stub");
  });

  it("parses proof matrix YAML for denali", () => {
    const matrix = parseProofMatrixYaml(readFileSync(PROOF_MATRIX, "utf8"));
    assert.ok(matrix.plugins.denali);
    assert.equal(proofStatusOf(matrix.plugins.denali.proofs["CERT-01"]), "pass");
    assert.equal(proofStatusOf(matrix.plugins.denali.proofs["CERT-05"]), "partial");
  });

  it("trunk manifests, generated file, and proof matrix are consistent", () => {
    const manifests = discoverManifests();
    const generated = readFileSync(GENERATED, "utf8");
    /** @type {Record<string, "stub" | "certified">} */
    const manifestTiers = {};
    for (const manifest of manifests) {
      manifestTiers[manifest.id] = resolveProductionCertificationTier(manifest);
    }

    const violations = collectCertificationViolations({
      manifestTiers,
      generatedTiers: parseProductionCertificationFromGenerated(generated),
      proofMatrix: parseProofMatrixYaml(readFileSync(PROOF_MATRIX, "utf8")),
      e2eHooksRaw: readFileSync(E2E_HOOKS, "utf8"),
      repoRoot: REPO_ROOT,
    });
    assert.deepEqual(violations, []);
  });

  it("guest-capable manifests sync operatorCapabilities with generated registry (PSC-C-04)", () => {
    const manifests = discoverManifests();
    const operatorCaps = readFileSync(OPERATOR_CAPS, "utf8");
    const violations = collectOperatorCapabilitiesViolations({
      manifests,
      generatedCaps: parseOperatorCapabilitiesFromGenerated(operatorCaps),
    });
    assert.deepEqual(violations, []);
    const caps = parseOperatorCapabilitiesFromGenerated(operatorCaps);
    assert.ok(caps["guest-club"]);
    assert.equal(caps.denali.fieldExposureSurfaces, true);
  });

  it("generateWorkspaceProductionCertification matches on-disk generated file", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceProductionCertification(manifests);
    assert.equal(generated, readFileSync(GENERATED, "utf8"));
  });

  it("rejects certified plugin missing from proof matrix", () => {
    const violations = collectCertificationViolations({
      manifestTiers: { alpine: "certified" },
      generatedTiers: { alpine: "certified" },
      proofMatrix: { plugins: {} },
      e2eHooksRaw: "",
      repoRoot: REPO_ROOT,
    });
    assert.match(violations.join("\n"), /alpine: certified plugin missing from proof matrix/);
  });
});
