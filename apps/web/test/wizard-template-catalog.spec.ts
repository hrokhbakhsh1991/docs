/**
 * Phase 9.6 W-track — wizard template catalog from plugin registry
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-sdk";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";

import { buildDenaliFullWizardTemplatePayload } from "@app-tour/workspace-denali";

import {
  applyWizardTemplatePreset,
  buildWizardTemplateCatalogFromPlugin,
  filterWizardTemplateCatalog,
  formatWizardTemplateStepLabel,
  isWizardTemplateCatalogFieldSelected,
  isWizardTemplatePaletteField,
  toggleWizardTemplateCatalogField,
  updateWizardTemplateFieldOverlay,
} from "../src/tours/wizard-template-catalog-logic";
import { resolveWizardTemplateFieldLabel } from "../src/tours/wizard-template-field-labels";

describe("wizard-template-catalog.spec.ts — W-track", () => {
  it("WEB-9.6-CAT-01 builds grouped catalog from starter plugin", () => {
    const catalog = buildWizardTemplateCatalogFromPlugin(getStarterWorkspacePlugin());
    assert.ok(catalog.length >= 1);
    assert.ok(catalog.some((step) => step.fields.some((field) => field.canonicalPath === "basics.title")));
  });

  it("WEB-9.6-CAT-02 toggles field selection in template steps", () => {
    const field = {
      canonicalPath: "basics.title",
      stepId: "basics",
      fieldId: "basics.title",
      kind: "text",
    };
    const steps = toggleWizardTemplateCatalogField([], field, true);
    assert.equal(isWizardTemplateCatalogFieldSelected(steps, "basics.title"), true);
    const cleared = toggleWizardTemplateCatalogField(steps, field, false);
    assert.equal(isWizardTemplateCatalogFieldSelected(cleared, "basics.title"), false);
  });

  it("WEB-9.6-CAT-03 formats denali step labels", () => {
    assert.equal(formatWizardTemplateStepLabel("denali_basic"), "اطلاعات پایه");
  });

  it("WEB-9.6-CAT-04 excludes denali Layer C paths from builder palette", () => {
    const denali = getDenaliWorkspacePlugin();
    const publishStatus = denali.fieldRegistry.fields.find(
      (field) => field.canonicalPath === "publishStatus"
    );
    assert.ok(publishStatus);
    assert.equal(isWizardTemplatePaletteField(publishStatus, []), false);

    const catalog = buildWizardTemplateCatalogFromPlugin(denali);
    const paths = catalog.flatMap((step) => step.fields.map((field) => field.canonicalPath));
    assert.equal(paths.includes("publishStatus"), false);
    assert.equal(paths.includes("pricing.paymentMode"), false);
    assert.ok(paths.includes("title"));
  });

  it("WEB-9.6-CAT-06 filters catalog by human label or path", () => {
    const catalog = buildWizardTemplateCatalogFromPlugin(getDenaliWorkspacePlugin());
    const filtered = filterWizardTemplateCatalog(catalog, "capacity", (field, stepLabel) => {
      const label = resolveWizardTemplateFieldLabel(field.canonicalPath, "denali");
      return (
        field.canonicalPath.toLowerCase().includes("capacity") ||
        label.toLowerCase().includes("capacity") ||
        stepLabel.toLowerCase().includes("capacity")
      );
    });
    const paths = filtered.flatMap((step) => step.fields.map((field) => field.canonicalPath));
    assert.ok(paths.includes("capacityMax"));
    assert.equal(paths.includes("title"), false);
  });

  it("WEB-9.6-CAT-07 applies Denali full preset intersected with catalog", () => {
    const denali = getDenaliWorkspacePlugin();
    const catalog = buildWizardTemplateCatalogFromPlugin(denali);
    const preset = buildDenaliFullWizardTemplatePayload("Summer trek");
    const applied = applyWizardTemplatePreset(preset, catalog, {
      seedLabel: "",
      sections: [],
      published: false,
      steps: [],
    });

    assert.equal(applied.seedLabel, "Summer trek");
    assert.equal(applied.published, true);
    assert.ok((applied.steps ?? []).length >= 5);

    const basic = (applied.steps ?? []).find((step) => step.stepId === "denali_basic");
    assert.ok(basic);
    const category = basic?.fields.find((field) => field.canonicalPath === "category");
    assert.equal(category?.required, true);

    const catalogPaths = new Set(
      catalog.flatMap((step) => step.fields.map((field) => field.canonicalPath))
    );
    for (const step of applied.steps ?? []) {
      for (const field of step.fields) {
        assert.ok(catalogPaths.has(field.canonicalPath));
      }
    }
    assert.equal(
      (applied.steps ?? []).flatMap((step) => step.fields).some((field) => field.canonicalPath === "publishStatus"),
      false
    );
  });

  it("WEB-9.6-CAT-05 updates required and defaultValue on selected field", () => {
    const field = {
      canonicalPath: "basics.title",
      stepId: "basics",
      fieldId: "basics.title",
      kind: "text",
    };
    const selected = toggleWizardTemplateCatalogField([], field, true);
    const required = updateWizardTemplateFieldOverlay(selected, "basics.title", {
      required: true,
    });
    const withDefault = updateWizardTemplateFieldOverlay(required, "basics.title", {
      defaultValue: "Default Tour",
    });
    assert.equal(withDefault[0]?.fields[0]?.required, true);
    assert.equal(withDefault[0]?.fields[0]?.defaultValue, "Default Tour");
  });
});
