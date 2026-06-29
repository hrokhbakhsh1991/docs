import type { ExposureProfile } from "./exposure-profile";

export type EnsureSeededExposureProfileInput = {
  readonly tenantId: string;
  readonly seed: ExposureProfile;
};

export type ExposureProfileRepository = {
  findByProfileId(input: {
    readonly tenantId: string;
    readonly profileId: string;
  }): Promise<ExposureProfile | null>;
  ensureSeededProfile(input: EnsureSeededExposureProfileInput): Promise<ExposureProfile>;
};
