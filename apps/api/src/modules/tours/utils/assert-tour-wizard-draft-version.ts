import { ConflictException } from "@nestjs/common";

/** First optimistic-lock generation for a newly created draft row. */
export const TOUR_WIZARD_DRAFT_INITIAL_VERSION = 1;

export function assertTourWizardDraftVersionMatch(
  existingVersion: number,
  incomingVersion: number,
): void {
  if (existingVersion !== incomingVersion) {
    throw new ConflictException({
      error: {
        code: "TOUR_WIZARD_DRAFT_STALE",
        message:
          "Tour wizard draft version mismatch. Refresh to load the latest server state.",
      },
    });
  }
}
