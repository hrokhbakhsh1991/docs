import type { TourFormProfile } from "@repo/types";
import {
  buildFieldStripRules,
  buildPublishPolicy,
  buildValidationRules,
  buildWizardConfig,
} from "./workspace.strategy.builders";
import type { IWorkspaceStrategy } from "./workspace.strategy.interface";
import { buildRequiredSubmitFields } from "./workspace.strategy.submit-fields";

/**
 * Default/classic workspace strategy — used for all profiles not routed to
 * {@link MountainOutdoorWorkspaceStrategy}.
 *
 * Optional publish/strip/invariant delegates live in legacy modules until Phase 2.2+
 * wiring; see SYSTEM_AUDIT.md delegate map.
 */
export class GeneralWorkspaceStrategy implements IWorkspaceStrategy {
  constructor(readonly profile: TourFormProfile) {}

  getValidationRules() {
    return buildValidationRules(this.profile);
  }

  getPublishPolicy() {
    return buildPublishPolicy(this.profile, { publishGeolocationCheck: null });
  }

  getFieldStripRules() {
    return buildFieldStripRules(this.profile, { appliesDenaliSingleDayLogisticsStrip: false });
  }

  getWizardConfig() {
    return buildWizardConfig(this.profile);
  }

  getRequiredSubmitFields() {
    return buildRequiredSubmitFields(this.profile);
  }
}
