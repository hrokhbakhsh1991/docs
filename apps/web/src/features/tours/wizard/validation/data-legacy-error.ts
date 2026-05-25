export const DATA_LEGACY_PROFILE_MISMATCH_MESSAGE =
  "Data Mismatch: Modern rail detected with legacy profile";

/** Thrown when workspace template storage and {@link TourFormProfile} authority disagree. */
export class DataLegacyError extends Error {
  readonly code = "DATA_LEGACY_PROFILE_MISMATCH" as const;

  constructor(message: string = DATA_LEGACY_PROFILE_MISMATCH_MESSAGE) {
    super(message);
    this.name = "DataLegacyError";
  }
}
