import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";

import { applyWizardDraftRestore } from "./apply-wizard-draft-restore";

const restoreSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "apply-wizard-draft-restore.ts"),
  "utf8",
);

const workspaceTemplate: TenantWizardTemplate = {
  id: "tpl-1",
  workspaceId: "ws-1",
  baseProfile: "mountain_outdoor",
  stepOverrides: { skip: [], insert: [] },
  fieldRulesOverlay: {},
  presetId: null,
  wizardContractVersion: 1,
  formProfileVersion: 1,
};

test("applyWizardDraftRestore uses workspace template baseProfile only", () => {
  assert.doesNotMatch(restoreSource, /defaultTourFormProfileForTourType/);
  assert.match(restoreSource, /workspaceTemplate\.baseProfile/);

  const { resolvedFormProfile, mergedValues } = applyWizardDraftRestore(
    {
      formPatch: {
        overview: {
          title: "restored",
          tourType: "city",
          mainTourThemeId: "22222222-2222-4222-8222-222222222222",
        } as never,
      },
      wizardMeta: {
        resolvedFormProfile: "urban_event",
        formProfileVersion: 1,
      },
    },
    buildTourCreateFormDefaultValues(),
    workspaceTemplate,
  );

  assert.equal(resolvedFormProfile, "mountain_outdoor");
  assert.equal(mergedValues.overview?.title, "restored");
  assert.equal(mergedValues.overview?.tourType, "city");
});
