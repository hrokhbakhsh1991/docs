import type { WorkspacePlugin } from "@repo/workspace-sdk";
import type { TourFormProfile } from "@repo/types";

import type { IWorkspaceStrategy } from "./workspace.strategy.interface";

/**
 * Phase 1.3 — {@link IWorkspaceStrategy} backed by a {@link WorkspacePlugin} contract
 * with behavior delegated to legacy strategy until full plugin cutover (Phase 2+).
 */
export class SdkWorkspaceStrategyAdapter implements IWorkspaceStrategy {
  constructor(
    readonly profile: TourFormProfile,
    private readonly plugin: WorkspacePlugin,
    private readonly legacy: IWorkspaceStrategy,
  ) {}

  /** SDK plugin contract (map.md Phase 1). */
  getWorkspacePlugin(): WorkspacePlugin {
    return this.plugin;
  }

  getValidationRules() {
    return this.legacy.getValidationRules();
  }

  getPublishPolicy() {
    return this.legacy.getPublishPolicy();
  }

  getFieldStripRules() {
    return this.legacy.getFieldStripRules();
  }

  getWizardConfig() {
    return this.legacy.getWizardConfig();
  }

  getRequiredSubmitFields() {
    return this.legacy.getRequiredSubmitFields();
  }
}
