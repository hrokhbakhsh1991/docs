import { DENALI_ROOTS } from "../denali-wizard.contract";
import type { TourWorkspaceDefinition } from "../workspace-definition";
import { checkDenaliPilotCapacity, checkDenaliPilotTripDetails } from "./denali-invariants";

export { checkDenaliPilotPublishGeolocationZones } from "./denali-invariants";

/**
 * Denali-specific workspace strategy (map.md §B).
 */
export const DENALI_WORKSPACE: TourWorkspaceDefinition = {
  profile: "denali_pilot",
  version: 1,
  roots: DENALI_ROOTS,
  ui: {
    wizardMode: "denali",
  },
  validation: {
    checkCapacity: checkDenaliPilotCapacity,
    checkTripDetails: checkDenaliPilotTripDetails,
  },
  lifecycle: {
    initialStatus: "DRAFT",
    publishStatus: "OPEN",
    allowedTransitions: [
      { from: "DRAFT", to: "OPEN" },
      { from: "DRAFT", to: "CANCELLED" },
      { from: "OPEN", to: "CLOSED" },
      { from: "OPEN", to: "CANCELLED" },
      { from: "CLOSED", to: "CANCELLED" },
    ],
  },
};
