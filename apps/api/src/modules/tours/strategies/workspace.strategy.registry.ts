import type { TourFormProfile } from "@repo/types";
import { GeneralWorkspaceStrategy } from "./general.workspace.strategy";
import { MountainOutdoorWorkspaceStrategy } from "./mountain-outdoor.workspace.strategy";
import { SdkWorkspaceStrategyAdapter } from "./sdk.workspace.strategy.adapter";
import type { IWorkspaceStrategy } from "./workspace.strategy.interface";
import { resolveWorkspacePluginForProfile } from "./workspace-plugin.resolver";

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
 * Defaults to {@link GeneralWorkspaceStrategy} when no mountain/outdoor strategy applies.
 */
export class WorkspaceStrategyRegistry {
  static resolve(profile: TourFormProfile): IWorkspaceStrategy {
    if (isDenaliStrategyProfile(profile)) {
      return new MountainOutdoorWorkspaceStrategy(profile);
    }

    const legacy = new GeneralWorkspaceStrategy(profile);
    const plugin = resolveWorkspacePluginForProfile(profile);
    if (plugin != null) {
      return new SdkWorkspaceStrategyAdapter(profile, plugin, legacy);
    }

    return legacy;
  }
}
