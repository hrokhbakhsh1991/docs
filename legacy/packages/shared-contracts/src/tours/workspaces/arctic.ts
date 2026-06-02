import type { TourWorkspaceDefinition } from "../workspace-definition";

/**
 * Arctic Workspace (map.md §F1) — Architectural Test Case.
 */
export const ARCTIC_WORKSPACE: TourWorkspaceDefinition = {
  profile: "nature_trip", // Reuse nature_trip profile for this workspace example
  version: 1,
  roots: ["basicInfo", "logistics", "policies"], // Slimmer roots
  ui: {
    wizardMode: "classic",
  },
  validation: {
    checkCapacity: (capacity) => {
      if (capacity < 5) {
        return {
          code: "WORKSPACE_RULE_ARCTIC_MIN_CAPACITY",
          message: "Arctic tours must have at least 5 participants.",
        };
      }
      return null;
    },
    checkTripDetails: () => null,
  },
  lifecycle: {
    initialStatus: "DRAFT",
    publishStatus: "OPEN",
    allowedTransitions: [
      { from: "DRAFT", to: "OPEN" },
      { from: "OPEN", to: "CLOSED" },
    ],
  },
};
