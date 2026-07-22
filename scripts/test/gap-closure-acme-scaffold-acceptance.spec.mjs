/**
 * Gap Closure E.1 — acme scaffold acceptance (create → codegen admission).
 * Proves a new guest workspace can be scaffolded and admitted by manifest collectors
 * without editing platform-core / workspace-sdk / apps/api contracts.
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import { generateManifestBoundaryAllowlist } from "../codegen/workspace-registry/domains/boundary-allowlist.mjs";
import {
  generateApiRegistry,
  productWorkspaceManifests,
} from "../codegen/workspace-registry/domains/core-registry.mjs";
import {
  buildDeployProfileBundlePlan,
  collectAdminProductTranspilePackages,
  collectGuestProductTranspilePackages,
  collectGuestRuntimeProductPackages,
  generateAdminTranspilePackages,
  generateGuestTranspilePackages,
} from "../codegen/workspace-registry/domains/theme.mjs";
import { evaluateWorkspaceOnboardContract } from "../codegen/workspace-registry/onboard-contract.mjs";
import { scaffoldWorkspace } from "../workspace-create.mjs";
import {
  formatWorkspaceOnboardPlanPayload,
  planWorkspaceOnboardSteps,
} from "../workspace-onboard.mjs";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");

const CORE_CONTRACT_PATHS = [
  "packages/platform-core/package.json",
  "packages/workspace-sdk/package.json",
  "apps/api/package.json",
  "apps/api/src/http/workspace-route-registrar.ts",
];

function hashFile(rel) {
  const abs = join(REPO_ROOT, rel);
  if (!existsSync(abs)) {
    return `missing:${rel}`;
  }
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function withTempRepo(fn) {
  const repoRoot = mkdtempSync(join(tmpdir(), "gap-closure-acme-"));
  try {
    return fn(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

describe("Gap Closure E.1 — acme-gap scaffold acceptance", () => {
  it("create → discover → transpile collectors admit package without core contract edits", () => {
    const before = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));

    withTempRepo((repoRoot) => {
      const { dir, pkgName } = scaffoldWorkspace({
        repoRoot,
        id: "acme-gap",
        guest: true,
      });
      assert.equal(pkgName, "@app-tour/workspace-acme-gap");
      assert.ok(existsSync(join(dir, "workspace.manifest.json")));
      const pkgJson = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      assert.equal(
        pkgJson.dependencies?.["@app-tour/catalog-registration-auth"],
        "workspace:*",
        "guest scaffold must declare catalog-registration-auth (flow TSX import)"
      );

      const manifests = discoverManifests(join(repoRoot, "packages/workspaces"));
      assert.equal(manifests.length, 1);
      assert.equal(manifests[0]?.id, "acme-gap");

      const adminProducts = collectAdminProductTranspilePackages(manifests);
      assert.ok(adminProducts.includes(pkgName));

      const marketingProducts = collectGuestProductTranspilePackages(manifests, "marketing");
      assert.ok(marketingProducts.includes(pkgName));

      const runtimeProducts = collectGuestRuntimeProductPackages(manifests);
      assert.ok(runtimeProducts.includes(pkgName));

      const adminSrc = generateAdminTranspilePackages(manifests, {});
      assert.match(adminSrc, /@app-tour\/workspace-acme-gap/);

      const marketingSrc = generateGuestTranspilePackages(manifests, "marketing", {});
      assert.match(marketingSrc, /@app-tour\/workspace-acme-gap/);

      const plan = buildDeployProfileBundlePlan(manifests, {});
      assert.ok(plan.adminTranspileProducts.includes(pkgName));
    });

    const after = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));
    for (const rel of CORE_CONTRACT_PATHS) {
      assert.equal(after[rel], before[rel], `core contract must stay unchanged: ${rel}`);
    }
    assert.equal(
      existsSync(join(REPO_ROOT, "packages/workspaces/acme-gap")),
      false,
      "acme-gap must not remain on trunk"
    );
  });

  it("E.2 union with trunk manifests admits acme-gap without trunk writes", () => {
    const before = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));
    const trunk = discoverManifests();

    withTempRepo((repoRoot) => {
      const { pkgName } = scaffoldWorkspace({
        repoRoot,
        id: "acme-gap",
        guest: true,
      });
      const acme = discoverManifests(join(repoRoot, "packages/workspaces"));
      assert.equal(acme.length, 1);

      const union = [...trunk, ...acme].sort((a, b) => a.id.localeCompare(b.id));
      assert.ok(union.some((m) => m.id === "acme-gap"));
      assert.ok(union.some((m) => m.id === "denali"));

      const adminProducts = collectAdminProductTranspilePackages(union);
      assert.ok(adminProducts.includes(pkgName));
      assert.ok(adminProducts.includes("@app-tour/workspace-denali"));

      const marketingProducts = collectGuestProductTranspilePackages(union, "marketing");
      assert.ok(marketingProducts.includes(pkgName));

      const adminSrc = generateAdminTranspilePackages(union, {});
      assert.match(adminSrc, /@app-tour\/workspace-acme-gap/);
      assert.match(adminSrc, /@app-tour\/workspace-denali/);
    });

    const after = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));
    for (const rel of CORE_CONTRACT_PATHS) {
      assert.equal(after[rel], before[rel], `core contract must stay unchanged: ${rel}`);
    }
    assert.equal(existsSync(join(REPO_ROOT, "packages/workspaces/acme-gap")), false);
  });

  it("E.3 boundary allowlist admits acme-gap in trunk union", () => {
    const before = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));
    const trunk = discoverManifests();

    withTempRepo((repoRoot) => {
      const { pkgName } = scaffoldWorkspace({
        repoRoot,
        id: "acme-gap",
        guest: true,
      });
      const acme = discoverManifests(join(repoRoot, "packages/workspaces"));
      const union = [...trunk, ...acme].sort((a, b) => a.id.localeCompare(b.id));
      const allowlist = generateManifestBoundaryAllowlist(union);
      assert.match(allowlist, /"acme-gap"/);
      assert.match(allowlist, new RegExp(pkgName.replace("/", "\\/")));
      assert.match(allowlist, /PRODUCT_WORKSPACE_IDS/);
      assert.match(allowlist, /PRODUCT_WORKSPACE_PACKAGES/);
    });

    const after = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));
    for (const rel of CORE_CONTRACT_PATHS) {
      assert.equal(after[rel], before[rel], `core contract must stay unchanged: ${rel}`);
    }
    assert.equal(existsSync(join(REPO_ROOT, "packages/workspaces/acme-gap")), false);
  });

  it("E.4a create→generate→onboard-contract admits acme-gap in memory", () => {
    const before = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));
    const trunk = discoverManifests();

    withTempRepo((repoRoot) => {
      scaffoldWorkspace({ repoRoot, id: "acme-gap", guest: true });
      const acme = discoverManifests(join(repoRoot, "packages/workspaces"));
      const union = [...trunk, ...acme].sort((a, b) => a.id.localeCompare(b.id));
      const product = productWorkspaceManifests(union);
      const generated = generateApiRegistry(union);

      assert.match(generated, /case "acme-gap":/);
      assert.match(generated, /@app-tour\/workspace-acme-gap/);

      const contract = evaluateWorkspaceOnboardContract(product, generated);
      assert.equal(
        contract.ok,
        true,
        contract.ok ? "ok" : `violations: ${contract.violations.join("; ")}`
      );
      assert.ok(contract.manifestIds.includes("acme-gap"));

      const plan = planWorkspaceOnboardSteps({ id: "acme-gap", guest: true });
      assert.equal(plan.pkgName, "@app-tour/workspace-acme-gap");
      assert.ok(plan.steps.some((s) => s.phase === "install"));
      assert.ok(plan.steps.some((s) => s.phase === "onboard-contract"));
      assert.ok(plan.steps.some((s) => s.phase === "guest-conformance"));

      const dry = formatWorkspaceOnboardPlanPayload(plan, { mode: "dry-run" });
      assert.equal(dry.mode, "dry-run");
      assert.match(dry.note, /E\.4b-prep/);
      assert.equal(dry.steps.length, plan.steps.length);
    });

    const after = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));
    for (const rel of CORE_CONTRACT_PATHS) {
      assert.equal(after[rel], before[rel], `core contract must stay unchanged: ${rel}`);
    }
    assert.equal(existsSync(join(REPO_ROOT, "packages/workspaces/acme-gap")), false);
  });
});

describe("Gap Closure E.4b-prep2 — trunk onboard dry-run plans", () => {
  it("every product workspace emits a dry-run onboard recipe without install", () => {
    const manifests = productWorkspaceManifests(discoverManifests());
    assert.ok(manifests.length >= 4, `expected trunk products, got ${manifests.length}`);

    for (const manifest of manifests) {
      const id = manifest.id;
      assert.ok(
        existsSync(join(REPO_ROOT, "packages/workspaces", id, "workspace.manifest.json")),
        `missing manifest for ${id}`
      );

      const guest = manifest.guestConformance != null;
      const plan = planWorkspaceOnboardSteps({ id, guest });
      const dry = formatWorkspaceOnboardPlanPayload(plan, { mode: "dry-run" });

      assert.equal(dry.mode, "dry-run");
      assert.equal(dry.pkgName, `@app-tour/workspace-${id}`);
      assert.ok(dry.steps.some((s) => s.phase === "install"));
      assert.ok(dry.steps.some((s) => s.phase === "onboard-contract"));
      assert.ok(dry.steps.some((s) => s.phase === "build"));
      assert.ok(dry.steps.some((s) => s.phase === "test"));
      if (guest) {
        assert.ok(
          dry.steps.some((s) => s.phase === "guest-conformance"),
          `${id} guest plan must include guest-conformance`
        );
      }
    }
  });
});
