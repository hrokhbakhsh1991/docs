import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";
import type { WorkspaceValidationPipelineContext } from "@app-tour/workspace-sdk";

import { validateWorkspaceDifficultyFitnessCapability } from "./workspace-difficulty-fitness-capability-validator.ts";
import { validateWorkspaceEquipmentCapability } from "./workspace-equipment-capability-validator.ts";
import { validateWorkspaceItineraryCapability } from "./workspace-itinerary-capability-validator.ts";
import { validateWorkspacePricingCapability } from "./workspace-pricing-capability-validator.ts";
import { validateWorkspaceTransportCapability } from "./workspace-transport-capability-validator.ts";

function baseCtx(
  workspaceType: string,
  data: Record<string, unknown>
): WorkspaceValidationPipelineContext {
  return {
    plugin: { id: workspaceType } as WorkspaceValidationPipelineContext["plugin"],
    document: createCanonicalDocument({
      schemaVersion: 1,
      roots: Object.keys(data),
      data,
    }),
    workspaceType,
    tenantId: "mat-002-test",
    validationMode: "draft",
    validationVariant: "default",
    dimensions: { variant: "default" },
  };
}

describe("MAT-002 capability validators", () => {
  it("equipment — positive denali-shaped gearItems passes", () => {
    const violation = validateWorkspaceEquipmentCapability(
      baseCtx("denali", {
        participants: {
          gearItems: [{ equipmentId: "eq-1", name: "Poles", isRequired: true }],
        },
      })
    );
    assert.equal(violation, null);
  });

  it("equipment — invalid gear item shape fails", () => {
    const violation = validateWorkspaceEquipmentCapability(
      baseCtx("denali", {
        participants: {
          gearItems: [{ equipmentId: "", name: "Poles" }],
        },
      })
    );
    assert.equal(violation?.code, "WORKSPACE_EQUIPMENT_INVALID");
  });

  it("equipment — urban absent capability no-ops", () => {
    const violation = validateWorkspaceEquipmentCapability(
      baseCtx("urban", {
        participants: {
          gearItems: [{ equipmentId: "", name: "Poles" }],
        },
      })
    );
    assert.equal(violation, null);
  });

  it("transport — positive denali mode passes", () => {
    const violation = validateWorkspaceTransportCapability(
      baseCtx("denali", {
        transport: { mode: "bus", allowPersonalCar: false, transportCost: 120000 },
      })
    );
    assert.equal(violation, null);
  });

  it("transport — invalid mode fails", () => {
    const violation = validateWorkspaceTransportCapability(
      baseCtx("denali", {
        transport: { mode: "hoverboard" },
      })
    );
    assert.equal(violation?.code, "WORKSPACE_TRANSPORT_INVALID");
  });

  it("transport — cert-club without wizardTourField no-ops", () => {
    const violation = validateWorkspaceTransportCapability(
      baseCtx("cert-club", {
        transport: { mode: "hoverboard" },
      })
    );
    assert.equal(violation, null);
  });

  it("pricing — positive base price passes", () => {
    const violation = validateWorkspacePricingCapability(
      baseCtx("denali", {
        pricing: { basePricePerPerson: 2500000 },
      })
    );
    assert.equal(violation, null);
  });

  it("pricing — negative base price fails", () => {
    const violation = validateWorkspacePricingCapability(
      baseCtx("denali", {
        pricing: { basePricePerPerson: -1 },
      })
    );
    assert.equal(violation?.code, "WORKSPACE_PRICING_INVALID");
  });

  it("difficulty/fitness — positive scalars pass", () => {
    const violation = validateWorkspaceDifficultyFitnessCapability(
      baseCtx("denali", {
        program: { difficultyLevel: 6 },
        participants: { fitnessLevel: "medium" },
      })
    );
    assert.equal(violation, null);
  });

  it("difficulty/fitness — invalid fitness slug fails", () => {
    const violation = validateWorkspaceDifficultyFitnessCapability(
      baseCtx("denali", {
        participants: { fitnessLevel: "   " },
      })
    );
    assert.equal(violation?.code, "WORKSPACE_DIFFICULTY_FITNESS_INVALID");
  });

  it("itinerary — positive day/segment tree passes", () => {
    const violation = validateWorkspaceItineraryCapability(
      baseCtx("denali", {
        program: {
          itinerary: [
            {
              dayNumber: 1,
              title: "Day one",
              segments: [{ id: "seg-1", kind: "activity", title: "Hike" }],
            },
          ],
        },
      })
    );
    assert.equal(violation, null);
  });

  it("itinerary — missing segment title fails", () => {
    const violation = validateWorkspaceItineraryCapability(
      baseCtx("denali", {
        program: {
          itinerary: [
            {
              dayNumber: 1,
              title: "Day one",
              segments: [{ id: "seg-1", kind: "activity", title: "" }],
            },
          ],
        },
      })
    );
    assert.equal(violation?.code, "WORKSPACE_ITINERARY_INVALID");
  });
});
