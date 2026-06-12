import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { getUrbanWorkspacePlugin } from "../src/urban.plugin";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN_DIR = join(PACKAGE_ROOT, "test/fixtures/golden");

function loadGoldenDocument(filename: string) {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, filename), "utf8")) as {
    schemaVersion: number;
    roots: string[];
    data: Record<string, unknown>;
  };
}

describe("urban-wizard-host-hooks.spec.ts (URB-12.8-01)", () => {
  it("urban plugin exposes platform wizardHost.validateDraftSync", () => {
    const plugin = getUrbanWorkspacePlugin();
    assert.ok(plugin.wizardHost);
    assert.equal(plugin.wizardHost.usesStepValidation, true);
    assert.equal(typeof plugin.wizardHost.validateDraftSync, "function");
  });

  it("resolveMatrixDimensionsFromDraft pins urban tourType city", () => {
    const plugin = getUrbanWorkspacePlugin();
    assert.deepEqual(plugin.wizardHost?.resolveMatrixDimensionsFromDraft?.({}, null), {
      tourType: "city",
    });
  });

  it("validateDraftSync accepts urban-tour-minimal golden draft envelope", () => {
    const plugin = getUrbanWorkspacePlugin();
    const golden = loadGoldenDocument("urban-tour-minimal.json");
    const result = plugin.wizardHost?.validateDraftSync?.({
      plugin,
      draft: { data: golden.data },
      rulesModule: null,
      tenantId: "urban-wizard-host-tenant",
    });
    assert.ok(result);
    assert.equal(result.ok, true, JSON.stringify(result.violations));
  });
});
