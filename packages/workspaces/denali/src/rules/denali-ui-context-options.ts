import type { TourFormProfile } from "../types/legacy/repo-types";

export type DenaliUIContextOptions = {
  mainThemeFormProfile?: TourFormProfile;
  workspaceFormProfile?: TourFormProfile;
  /** When set, gates `socialMediaLink` via contextual rule `telegramIntegrationActive`. */
  telegramIntegrationActive?: boolean;
};
