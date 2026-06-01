import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import { deepStripUnregisteredDenaliWizardKeys } from "./deepStripUnregisteredDenaliWizardKeys";
import { pruneDenaliWizardFormToRegistry } from "./pruneDenaliWizardFormToRegistry";

const GHOST_KEY = "__ghostGatheringPointRowKey";

function formWithGatheringGhost(): DenaliCreateTourWizardForm {
  const form = buildDenaliTourCreateDefaultValues();
  form.tripDetails = {
    ...form.tripDetails,
    logistics: {
      ...form.tripDetails.logistics,
      gatheringPoints: [
        {
          title: "Meet",
          time: "08:00",
          location: { addressText: "Station", latitude: 35.7, longitude: 51.4 },
          [GHOST_KEY]: "smuggled",
        } as NonNullable<
          DenaliCreateTourWizardForm["tripDetails"]["logistics"]
        >["gatheringPoints"][number] & { [GHOST_KEY]: string },
      ],
    },
  };
  return form;
}

test("pruneDenaliWizardFormToRegistry: ghost injection fails if array rows are wiped (semicolon-trap)", () => {
  const pruned = pruneDenaliWizardFormToRegistry(formWithGatheringGhost());
  const row = pruned.tripDetails.logistics!.gatheringPoints![0] as Record<string, unknown>;
  assert.equal(pruned.tripDetails.logistics?.gatheringPoints?.length, 1);
  assert.equal(row.title, "Meet");
  assert.equal(row.time, "08:00");
  assert.equal(
    (row.location as { addressText?: string } | undefined)?.addressText,
    "Station",
  );
  assert.equal(row[GHOST_KEY], undefined);
});

test("pruneDenaliWizardFormToRegistry: ghost injection fails if registry path copy is skipped", () => {
  const source = formWithGatheringGhost();
  source.basicInfo.title = "Unique prune title";

  const pruned = pruneDenaliWizardFormToRegistry(source);
  assert.equal(pruned.basicInfo.title, "Unique prune title");
});

test("pruneDenaliWizardFormToRegistry: nested overview ghost is false-green if deepStrip is identity (M3 trap)", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.title = "Title retained";
  form.tripDetails = {
    ...form.tripDetails,
    overview: {
      ...form.tripDetails.overview,
      peakHeight: 4100,
      __ghostOverviewNested: "must not survive",
    } as DenaliCreateTourWizardForm["tripDetails"]["overview"] & { __ghostOverviewNested: string },
  };

  const pruned = pruneDenaliWizardFormToRegistry(form);
  const overview = pruned.tripDetails.overview as Record<string, unknown>;
  assert.equal(overview.__ghostOverviewNested, undefined);
  assert.equal(overview.peakHeight, 4100);
  assert.equal(pruned.basicInfo.title, "Title retained");
});

test("deepStripUnregisteredDenaliWizardKeys: ghost injection fails if export becomes identity (M3 trap)", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.tripDetails = {
    ...form.tripDetails,
    overview: {
      ...form.tripDetails.overview,
      peakHeight: 4200,
      __ghostOverviewKey: "must not survive",
    } as DenaliCreateTourWizardForm["tripDetails"]["overview"] & { __ghostOverviewKey: string },
  };

  const stripped = deepStripUnregisteredDenaliWizardKeys(form);
  const overview = stripped.tripDetails.overview as Record<string, unknown>;
  assert.equal(overview.__ghostOverviewKey, undefined);
  assert.equal(overview.peakHeight, 4200);
});
