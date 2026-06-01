import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import { pruneDenaliWizardFormToRegistry } from "./pruneDenaliWizardFormToRegistry";

function buildFormWithNestedGhostKeys(): DenaliCreateTourWizardForm {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.title = "Deep prune contract";
  form.tripDetails = {
    ...form.tripDetails,
    overview: {
      ...form.tripDetails.overview,
      __ghostOverviewKey: "must be stripped",
    } as DenaliCreateTourWizardForm["tripDetails"]["overview"],
  };
  return form;
}

test("pruneDenaliWizardFormToRegistry deep-strips nested keys outside registry paths", () => {
  const pruned = pruneDenaliWizardFormToRegistry(buildFormWithNestedGhostKeys());
  const overview = pruned.tripDetails.overview as Record<string, unknown>;
  assert.equal(overview.__ghostOverviewKey, undefined);
  assert.equal(pruned.basicInfo.title, "Deep prune contract");
});
