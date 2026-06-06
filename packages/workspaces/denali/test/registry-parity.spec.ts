import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import { DENALI_FIELD_DEFINITIONS } from "../src/field-registry/denaliFieldRegistryData";
import { listDenaliRegistryCanonicalPaths } from "../src/field-registry/DenaliFieldRegistry";
import { denaliWizardSteps } from "../src/layout/stepIds";
import type { DenaliCreateTourWizardForm } from "../src/schemas/denaliCore.schema";
import { evaluateFormRules } from "../src/rules/evaluateFormRules";
import { getDenaliWorkspacePlugin } from "../src/denali.plugin";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN_DIR = join(PACKAGE_ROOT, "test/fixtures/golden");

const LEGACY_FIELD_REGISTRY_COUNT = 59;

function loadGoldenForm(filename: string): DenaliCreateTourWizardForm {
  const raw = JSON.parse(readFileSync(join(GOLDEN_DIR, filename), "utf8")) as Record<
    string,
    unknown
  >;
  const { _templateOverlay: _ignored, ...form } = raw;
  return form as DenaliCreateTourWizardForm;
}

function buildDenaliCanonicalShell(roots: readonly string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const root of roots) {
    if (
      root.startsWith("denali_") ||
      root === "review" ||
      root === "program" ||
      root === "transport" ||
      root === "pricing" ||
      root === "participants" ||
      root === "policies" ||
      root === "tripDetails" ||
      root === "photos" ||
      root === "gatheringPoints"
    ) {
      data[root] = {};
      continue;
    }
    data[root] = null;
  }
  return data;
}

function snapshotEvaluateFormRules(form: DenaliCreateTourWizardForm): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const step of denaliWizardSteps) {
    if (step === "review") continue;
    out[step] = evaluateFormRules(form, step);
  }
  return out;
}

describe("registry-parity.spec.ts (REQ-P6-006,007,008,015,023)", () => {
  it("field registry id count matches legacy manifest (59)", () => {
    assert.equal(DENALI_FIELD_DEFINITIONS.length, LEGACY_FIELD_REGISTRY_COUNT);
    assert.equal(listDenaliRegistryCanonicalPaths().length, LEGACY_FIELD_REGISTRY_COUNT);
  });

  it("evaluateFormRules matches golden expected output (3 fixtures)", () => {
    const expected = JSON.parse(
      readFileSync(join(GOLDEN_DIR, "evaluate-form-rules.expected.json"), "utf8")
    ) as Record<string, Record<string, unknown>>;

    const cases = [
      ["tour-minimal.json", "tour-minimal"],
      ["tour-template-overlay.json", "tour-template-overlay"],
      ["tour-publish-ready.json", "tour-publish-ready"],
    ] as const;

    for (const [file, key] of cases) {
      const form = loadGoldenForm(file);
      assert.deepEqual(
        snapshotEvaluateFormRules(form),
        expected[key],
        `evaluateFormRules parity failed for ${file}`
      );
    }
  });

  it("validateCanonical fails closed on invalid Denali canonical", () => {
    const plugin = getDenaliWorkspacePlugin();
    const engine = PlatformWizardEngine.create(plugin);
    const roots = plugin.wizard.roots;
    const data = buildDenaliCanonicalShell(roots);
    data.title = "";

    const invalid = createCanonicalDocument({
      schemaVersion: 1,
      roots,
      data,
    });

    const result = engine.validateCanonical(invalid, {
      tenantId: "parity-tenant",
      dimensions: { category: "mountain", duration: "single_day" },
    });

    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some((v) => v.fieldId === "title" || v.code === "REQUIRED_FIELD_EMPTY"),
      JSON.stringify(result.violations)
    );
  });

  it("ACL boundary — no monorepo legacy/ imports outside src/acl/ (runtime src only)", () => {
    const srcRoot = join(PACKAGE_ROOT, "src");
    let output = "";
    try {
      output = execSync(
        `rg -n 'from ["\\x27][^"\\x27]*legacy/' "${srcRoot}" --glob '!**/acl/**' || true`,
        { encoding: "utf8" }
      );
    } catch {
      output = "";
    }
    const hits = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.includes("types/legacy/"));
    assert.deepEqual(hits, []);
  });
});
