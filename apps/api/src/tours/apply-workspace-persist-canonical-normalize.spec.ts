import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { getStarterWorkspacePlugin, resolveWizardHostCapability } from "@app-tour/workspace-sdk";

import { applyWorkspacePersistCanonicalNormalize } from "./apply-workspace-persist-canonical-normalize";

const TENANT = "00000000-0000-4000-8000-000000000003";
const DEST = "00000000-0000-4000-8000-000000000705";

describe("apply-workspace-persist-canonical-normalize.spec.ts", () => {
  it("API-PEAK-LOCK-01 starter omits the hook and does not list destinations", async () => {
    let listed = 0;
    const input = {
      tenantId: TENANT,
      workspaceType: "starter",
      body: { data: { title: "x" }, roots: ["basics"] },
    };
    const next = await applyWorkspacePersistCanonicalNormalize(input, {
      resolvePlugin: async () => getStarterWorkspacePlugin(),
      listDestinations: async () => {
        listed += 1;
        return [];
      },
    });
    assert.equal(listed, 0);
    assert.equal(next, input);
  });

  it("API-PEAK-LOCK-01b denali overwrites crafted peakHeight from opaque destinations", async () => {
    const plugin = getDenaliWorkspacePlugin();
    assert.equal(typeof resolveWizardHostCapability(plugin)?.normalizeCanonicalForPersist, "function");
    const next = await applyWorkspacePersistCanonicalNormalize(
      {
        tenantId: TENANT,
        workspaceType: "denali",
        body: {
          roots: ["title", "destinationId", "category", "tripDetails"],
          data: {
            category: "mountain_day",
            destinationId: DEST,
            tripDetails: { overview: { peakHeight: 111 } },
          },
        },
      },
      {
        resolvePlugin: async () => plugin,
        listDestinations: async () => [
          {
            id: DEST,
            locationType: "peak",
            altitudeM: 3962,
            typicalTrailDistanceKm: null,
          },
        ],
      }
    );
    const overview = (
      next.body.data as { tripDetails: { overview: { peakHeight: number } } }
    ).tripDetails.overview;
    assert.equal(overview.peakHeight, 3962);
  });

  it("API-PEAK-LOCK-01c denali leaves crafted peakHeight when catalog does not lock", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const next = await applyWorkspacePersistCanonicalNormalize(
      {
        tenantId: TENANT,
        workspaceType: "denali",
        body: {
          roots: ["title", "destinationId", "category", "tripDetails"],
          data: {
            category: "mountain_day",
            destinationId: DEST,
            tripDetails: { overview: { peakHeight: 111 } },
          },
        },
      },
      {
        resolvePlugin: async () => plugin,
        listDestinations: async () => [
          {
            id: DEST,
            locationType: "peak",
            altitudeM: null,
            typicalTrailDistanceKm: null,
          },
        ],
      }
    );
    const overview = (
      next.body.data as { tripDetails: { overview: { peakHeight: number } } }
    ).tripDetails.overview;
    assert.equal(overview.peakHeight, 111);
  });
});
