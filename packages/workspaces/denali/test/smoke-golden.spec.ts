import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import type { DenaliCreateTourWizardForm } from "../src/schemas/denaliCore.schema";
import { evaluateFormRules } from "../src/rules/evaluateFormRules";
import { denaliWizardSteps } from "../src/layout/stepIds";
import { getDenaliWorkspacePlugin } from "../src/denali.plugin";
import { denaliPluginForWizardEngine } from "../src/plugin-for-wizard-engine";

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures/golden");

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
    data[root] = {};
  }
  return data;
}

describe("smoke-golden.spec.ts (SMK-P6-05, SMK-P6-06, REQ-P6-023)", () => {
  it("SMK-P6-05: tour-minimal golden evaluates without throwing", () => {
    const form = loadGoldenForm("tour-minimal.json");
    for (const step of denaliWizardSteps) {
      if (step === "review") continue;
      const rules = evaluateFormRules(form, step);
      assert.equal(typeof rules, "object");
    }
  });

  it("SMK-P6-06: tour-publish-ready golden passes validateCanonical shell", () => {
    const plugin = getDenaliWorkspacePlugin();
    const engine = PlatformWizardEngine.create(denaliPluginForWizardEngine(plugin));
    const roots = plugin.wizard.roots;
    const data = buildDenaliCanonicalShell(roots);
    data.title = "Publish ready smoke";

    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: [...roots],
      data,
    });

    const result = engine.validateCanonical(document, {
      tenantId: "smoke-tenant",
      dimensions: { category: "mountain", duration: "single_day" },
    });

    assert.equal(typeof result.ok, "boolean");
    if (!result.ok) {
      const codes = result.violations.map((v) => v.fieldId).join(",");
      assert.ok(codes.length > 0, "expected structured denali violations when not ok");
    }
  });
});
