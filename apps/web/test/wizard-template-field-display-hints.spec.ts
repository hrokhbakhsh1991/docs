import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliWizardTemplateCatalogFieldMeta } from "@app-tour/workspace-denali/settings/wizard-template-catalog-meta";

import { resolveWizardTemplateEditor } from "../src/bootstrap/workspace-wizard-template-editor-bindings.generated";
import { resolveWizardTemplateFieldDisplayHintsFromMeta } from "../src/tours/wizard-template-field-display-hints";

describe("wizard-template-field-display-hints.spec.ts", () => {
  const tSettings = (key: string, values?: Record<string, string | number>) => {
    if (key === "hints.optionalAtCreate") {
      return "optional";
    }
    if (key === "hints.parentField" && values?.name) {
      return `parent:${values.name}`;
    }
    return key;
  };

  it("WEB-TPL-HINT-01 optional create hint for nationalIdRequired", () => {
    const editor = resolveWizardTemplateEditor("denali");
    assert.ok(editor != null);
    const meta = resolveDenaliWizardTemplateCatalogFieldMeta(
      "participants.nationalIdRequired",
      "denali_pricing",
      ["participants.minimumAge", "participants.nationalIdRequired"]
    );
    const hints = resolveWizardTemplateFieldDisplayHintsFromMeta(
      editor!,
      tSettings,
      () => "section",
      (path) => path,
      meta
    );
    assert.equal(hints.parentLabel, "section");
    assert.equal(hints.createTourHint, "optional");
  });

  it("WEB-TPL-HINT-02 templateFrozen hint for title", () => {
    const editor = resolveWizardTemplateEditor("denali");
    assert.ok(editor != null);
    const meta = resolveDenaliWizardTemplateCatalogFieldMeta(
      "title",
      "denali_basic",
      ["title", "category"]
    );
    const hints = resolveWizardTemplateFieldDisplayHintsFromMeta(
      editor!,
      tSettings,
      () => "section",
      (path) => path,
      meta
    );
    assert.equal(hints.createTourHint, "hints.templateFrozen");
  });
});
