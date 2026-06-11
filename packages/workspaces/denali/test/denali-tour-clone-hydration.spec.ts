import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  appendDenaliCloneTitleSuffix,
  denaliHydrateTourCloneDraft,
  filterGearItemsToActiveEquipmentCatalog,
  prepareDenaliServerCloneCanonical,
} from "../src/clone/denali-tour-clone-hydration";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "golden");

describe("denali-tour-clone-hydration.spec.ts — Phase 11.6", () => {
  it("WEB-P11-6-01 appendCopy suffix is idempotent", () => {
    assert.equal(appendDenaliCloneTitleSuffix("Alpine day"), "Alpine day (Copy)");
    assert.equal(
      appendDenaliCloneTitleSuffix("Alpine day (Copy)"),
      "Alpine day (Copy)"
    );
  });

  it("WEB-P11-6-02 legacy basicInfo flattens title with Copy suffix", () => {
    const source = JSON.parse(
      readFileSync(join(fixtureDir, "tour-publish-ready.json"), "utf8")
    ) as Record<string, unknown>;
    const hydrated = denaliHydrateTourCloneDraft(source);
    assert.equal(
      hydrated.data.title,
      "صعود به قله دماوند - جبهه جنوبی (Copy)"
    );
    assert.equal(hydrated.data.publishStatus, "draft");
    assert.equal(hydrated.data.destinationId, "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
  });

  it("WEB-P11-6-03 gear filter drops stale equipment ids", () => {
    const source = {
      title: "Gear tour",
      participants: {
        gearItems: [
          { equipmentId: "eq-active", name: "Axe", isRequired: true },
          { equipmentId: "eq-stale", name: "Rope", isRequired: false },
        ],
      },
    };
    const hydrated = denaliHydrateTourCloneDraft(source, {
      activeEquipmentIds: ["eq-active"],
    });
    const gear = hydrated.data.participants as { gearItems: Array<{ equipmentId: string }> };
    assert.equal(gear.gearItems.length, 1);
    assert.equal(gear.gearItems[0]?.equipmentId, "eq-active");
  });

  it("WEB-P11-6-04 filterGearItemsToActiveEquipmentCatalog without ids is noop", () => {
    const rows = [{ equipmentId: "eq-1", name: "Pack" }];
    assert.deepEqual(
      filterGearItemsToActiveEquipmentCatalog(rows, undefined),
      rows
    );
  });

  it("API-P11-12-01 prepareDenaliServerCloneCanonical keeps canonical shape with Copy title", () => {
    const source = JSON.parse(
      readFileSync(join(fixtureDir, "tour-minimal.json"), "utf8")
    ) as Record<string, unknown>;
    const cloned = prepareDenaliServerCloneCanonical(source);
    const basicInfo = cloned.basicInfo as { title: string; publishStatus: string };
    assert.equal(basicInfo.title, "Test (Copy)");
    assert.equal(basicInfo.publishStatus, "draft");
    assert.ok("basicInfo" in cloned, "legacy basicInfo root retained for server clone");
  });

  it("WEB-P11-6-05 empty activeEquipmentIds removes all gear rows", () => {
    const source = {
      title: "Gear tour",
      participants: {
        gearItems: [{ equipmentId: "eq-1", name: "Axe" }],
      },
    };
    const hydrated = denaliHydrateTourCloneDraft(source, { activeEquipmentIds: [] });
    const gear = hydrated.data.participants as { gearItems: unknown[] };
    assert.equal(gear.gearItems.length, 0);
  });
});
