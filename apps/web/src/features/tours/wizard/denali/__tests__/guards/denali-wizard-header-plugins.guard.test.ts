/**
 * Filesystem guard: create-wizard header plugin registration.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describeStructuralGuard } from "@/features/tours/wizard/testing/structural-guard";

const webSrcRoot = join(__dirname, "../../../../../..");

const wizardSource = readFileSync(
  join(webSrcRoot, "components/tours/wizard/WorkspaceTourWizard.tsx"),
  "utf8",
);

const editSource = readFileSync(
  join(webSrcRoot, "components/tours/DenaliTourEditForm.tsx"),
  "utf8",
);

const pluginSource = readFileSync(
  join(webSrcRoot, "features/tours/wizard/denali/plugins/DenaliTemplateSelectorPlugin.tsx"),
  "utf8",
);

describeStructuralGuard("denali wizard header plugins", [
  {
    name: "WorkspaceTourWizard registers CREATE_PLUGINS with template selector",
    run: () => {
      assert.match(wizardSource, /const CREATE_PLUGINS/);
      assert.match(wizardSource, /denaliTemplateSelectorPlugin/);
      assert.match(wizardSource, /denaliWizardClearAllPlugin/);
      assert.match(wizardSource, /<DenaliWizardHeaderPlugins/);
      assert.match(wizardSource, /onCanonicalSync:\s*\(\)\s*=>\s*setCanonicalSyncToken/);
      assert.match(wizardSource, /onClearAll:\s*handleClearAll/);
      assert.match(wizardSource, /resetWizardToRegistryDefaults/);
    },
  },
  {
    name: "DenaliTourEditForm does not register header plugins",
    run: () => {
      assert.doesNotMatch(editSource, /CREATE_PLUGINS/);
      assert.doesNotMatch(editSource, /DenaliWizardHeaderPlugins/);
      assert.doesNotMatch(editSource, /DenaliTourCreationPresetBanner/);
    },
  },
  {
    name: "template selector plugin renders only on denali_basic",
    run: () => {
      assert.match(pluginSource, /activeStepId === "denali_basic"/);
    },
  },
]);
