import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import { pruneDenaliWizardFormToRegistry } from "./pruneDenaliWizardFormToRegistry";

const GHOST_KEY = "__ghostTripDetailsArrayKey";

function buildFormWithTripDetailsArrayGhost(): DenaliCreateTourWizardForm {
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
          [GHOST_KEY]: "must not survive submit prune",
        } as NonNullable<
          DenaliCreateTourWizardForm["tripDetails"]["logistics"]
        >["gatheringPoints"][number] & { [GHOST_KEY]: string },
      ],
    },
  };
  return form;
}

/**
 * Audit 54: nested ghost inside `tripDetails.logistics.gatheringPoints[]` must be stripped before submit.
 * When this test fails, array interiors are not deep-stripped (see deepStripUnregisteredDenaliWizardKeys).
 */
test("pruneDenaliWizardFormToRegistry strips ghost keys inside tripDetails gatheringPoints rows", () => {
  const pruned = pruneDenaliWizardFormToRegistry(buildFormWithTripDetailsArrayGhost());
  const rows = pruned.tripDetails.logistics?.gatheringPoints;
  assert.equal(rows?.length, 1, "gatheringPoints row must survive prune");
  const row = rows![0] as Record<string, unknown>;
  assert.equal(row.title, "Meet");
  assert.equal(row.time, "08:00");
  assert.equal(
    (row.location as { addressText?: string } | undefined)?.addressText,
    "Station",
  );
  assert.equal(
    row[GHOST_KEY],
    undefined,
    "ghost keys inside tripDetails array elements must be removed by submit prune",
  );
  assert.equal(
    Object.keys(row).every((key) => key !== GHOST_KEY),
    true,
    "ghost injection must not pass as false-green",
  );
});
