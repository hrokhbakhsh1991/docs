/**
 * Wizard template field labels — human-readable catalog copy
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";

import {
  denaliMessagesFromAppMessages,
  resolveDenaliFieldKindLabelFromMessages,
  resolveDenaliFieldLabelFromMessages,
  resolveDenaliStepLabelFromMessages,
} from "../src/i18n/denali-wizard-labels";
import { loadAppMessages } from "../src/i18n/load-messages";
import { buildWizardTemplateCatalogFromPlugin } from "../src/tours/wizard-template-catalog-logic";
import {
  formatCanonicalPathToLabel,
  formatWizardTemplateFieldKindLabel,
  formatWizardTemplateStepLabel,
  resolveWizardTemplateFieldKindLabel,
  resolveWizardTemplateFieldLabel,
} from "../src/tours/wizard-template-field-labels";
import {
  countWizardTemplateSelectedFields,
  validateWizardTemplateSavable,
} from "../src/tours/wizard-template-gate-logic";

describe("wizard-template-field-labels.spec.ts", () => {
  it("WEB-WIZ-LABEL-01 formats camelCase paths for starter fields", () => {
    assert.equal(formatCanonicalPathToLabel("basics.title"), "Title");
    assert.equal(formatCanonicalPathToLabel("tripDetails.overview.peakHeight"), "Peak Height");
  });

  it("WEB-WIZ-LABEL-02 resolves denali-specific labels (legacy fa parity)", async () => {
    const messages = await loadAppMessages("fa");
    const denali = denaliMessagesFromAppMessages(messages, "fa");
    const translate = (key: string) => {
      if (key.startsWith("fields.")) {
        return resolveDenaliFieldLabelFromMessages(denali, key.slice("fields.".length));
      }
      return key;
    };
    assert.equal(resolveDenaliFieldLabelFromMessages(denali, "title"), "نام تور");
    assert.equal(resolveDenaliFieldLabelFromMessages(denali, "capacityMax"), "حداکثر ظرفیت");
    assert.equal(resolveWizardTemplateFieldLabel("title", "denali", translate), "نام تور");
    assert.equal(resolveWizardTemplateFieldLabel("capacityMax", "denali", translate), "حداکثر ظرفیت");
  });

  it("WEB-WIZ-LABEL-02b resolves denali labels in English", async () => {
    const messages = await loadAppMessages("en");
    const denali = denaliMessagesFromAppMessages(messages, "en");
    assert.equal(resolveDenaliFieldLabelFromMessages(denali, "title"), "Tour name");
    assert.equal(resolveDenaliStepLabelFromMessages(denali, "denali_basic"), "Basic info");
  });

  it("WEB-WIZ-LABEL-03 maps composite kind to multi-field widget", async () => {
    const fa = denaliMessagesFromAppMessages(await loadAppMessages("fa"), "fa");
    const en = denaliMessagesFromAppMessages(await loadAppMessages("en"), "en");
    assert.equal(resolveDenaliFieldKindLabelFromMessages(fa, "composite"), "ویجت چندفیلدی");
    assert.equal(resolveDenaliFieldKindLabelFromMessages(en, "composite"), "Multi-field widget");
    assert.equal(formatWizardTemplateFieldKindLabel("composite"), "Composite");
    assert.equal(formatWizardTemplateFieldKindLabel("text"), "Text");
    assert.equal(
      resolveWizardTemplateFieldKindLabel("composite", "denali", (key) =>
        key === "fieldKinds.composite" ? "Multi-field widget" : key
      ),
      "Multi-field widget"
    );
  });

  it("WEB-WIZ-LABEL-04 denali catalog fields have readable labels", async () => {
    const messages = await loadAppMessages("fa");
    const denali = denaliMessagesFromAppMessages(messages, "fa");
    const translate = (key: string) => {
      if (key.startsWith("fields.")) {
        return resolveDenaliFieldLabelFromMessages(denali, key.slice("fields.".length));
      }
      if (key.startsWith("steps.")) {
        return resolveDenaliStepLabelFromMessages(denali, key.slice("steps.".length));
      }
      return key;
    };
    const catalog = buildWizardTemplateCatalogFromPlugin(getDenaliWorkspacePlugin());
    const title = catalog
      .flatMap((step) => step.fields)
      .find((field) => field.canonicalPath === "title");
    assert.ok(title);
    assert.equal(resolveWizardTemplateFieldLabel(title.canonicalPath, "denali", translate), "نام تور");
    assert.notEqual(resolveWizardTemplateFieldLabel(title.canonicalPath, "denali", translate), "title");
    assert.equal(formatWizardTemplateStepLabel("denali_basic", "denali", translate), "اطلاعات پایه");
  });

  it("WEB-WIZ-LABEL-05 blocks publish save without selected fields", () => {
    assert.equal(
      validateWizardTemplateSavable({
        seedLabel: "",
        sections: [],
        published: true,
        steps: [],
      }),
      "WIZARD_TEMPLATE_PUBLISH_NO_FIELDS"
    );
    assert.equal(
      validateWizardTemplateSavable({
        seedLabel: "",
        sections: [],
        published: false,
        steps: [],
      }),
      null
    );
    assert.equal(
      countWizardTemplateSelectedFields([
        {
          stepId: "basics",
          label: "Basics",
          enabled: true,
          fields: [{ canonicalPath: "title" }],
        },
      ]),
      1
    );
  });
});
