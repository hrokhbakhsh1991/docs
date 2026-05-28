import type { CreateTourDto } from "../dto/create-tour.dto";

/**
 * Minimal wire shape for profile submit-required checks (POST create and PATCH → OPEN).
 * Kept separate from {@link assert-profile-required-fields-for-submit} to avoid
 * strategy registry circular imports.
 */
export type ProfileRequiredSubmitShape = {
  title: string;
  cost_context?: { totalCost?: number | null } | null;
  tripDetails?: CreateTourDto["tripDetails"] | null;
  transportModes?: readonly string[] | null;
};
