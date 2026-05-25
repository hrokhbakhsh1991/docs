import type { TourFormProfile } from "@repo/types";
import { DenaliWorkspaceStrategy } from "./denali.workspace.strategy";
import { GeneralWorkspaceStrategy } from "./general.workspace.strategy";
import type { IWorkspaceStrategy } from "./workspace.strategy.interface";

export const DENALI_STRATEGY_PROFILES = ["denali_pilot", "urban_event"] as const satisfies readonly TourFormProfile[];

export type DenaliStrategyProfile = (typeof DENALI_STRATEGY_PROFILES)[number];

export function isDenaliStrategyProfile(profile: TourFormProfile): profile is DenaliStrategyProfile {
  return (DENALI_STRATEGY_PROFILES as readonly string[]).includes(profile);
}

/** Settings / template paths that persist Denali `canonicalData` (not classic preset defaults). */
export function usesDenaliCanonicalTemplate(profile: TourFormProfile): boolean {
  return profile === "denali_pilot";
}

/**
 * Resolves the workspace strategy for a tour form profile.
 * Defaults to {@link GeneralWorkspaceStrategy} when no Denali-specific strategy applies.
 */
export class WorkspaceStrategyRegistry {
  static resolve(profile: TourFormProfile): IWorkspaceStrategy {
    if (isDenaliStrategyProfile(profile)) {
      return new DenaliWorkspaceStrategy(profile);
    }
    return new GeneralWorkspaceStrategy(profile);
  }
}
