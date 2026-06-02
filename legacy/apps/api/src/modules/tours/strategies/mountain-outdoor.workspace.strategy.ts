import {
  denaliPrimaryTransportSubmitValue,
  type TourFormProfile,
  type TourTripDetails,
  type WizardSubmitRequiredFieldPath,
} from "@repo/types";
import {
  checkDenaliPilotPublishGeolocationZones,
  getWorkspaceUiCapabilityFlags,
  type WorkspaceInvariantViolation,
} from "@repo/shared-contracts";
import type { ProfileRequiredSubmitShape } from "../utils/profile-required-submit-shape";
import {
  buildFieldStripRules,
  buildPublishPolicy,
  buildValidationRules,
  buildWizardConfig,
} from "./workspace.strategy.builders";
import type { IWorkspaceStrategy, WorkspaceRequiredSubmitFields } from "./workspace.strategy.interface";
import {
  buildRequiredSubmitFields,
  readDefaultSubmitFieldValue,
} from "./workspace.strategy.submit-fields";

function resolvePublishGeolocationCheck(
  profile: TourFormProfile,
): ((_tripDetails: unknown) => WorkspaceInvariantViolation | null) | null {
  if (!getWorkspaceUiCapabilityFlags(profile).requiresGeoPublish) {
    return null;
  }
  return (tripDetails: unknown) => {
    const details = tripDetails as TourTripDetails | null | undefined;
    return checkDenaliPilotPublishGeolocationZones(details);
  };
}

function resolveDenaliSingleDayLogisticsStrip(profile: TourFormProfile): boolean {
  return getWorkspaceUiCapabilityFlags(profile).appliesDenaliSingleDayLogisticsStrip;
}

/**
 * Mountain/outdoor vertical workspace strategy — `denali_pilot` and `urban_event`
 * (both use `DENALI_WORKSPACE` rules in `@repo/shared-contracts`).
 */
export class MountainOutdoorWorkspaceStrategy implements IWorkspaceStrategy {
  constructor(readonly profile: TourFormProfile) {}

  getValidationRules() {
    return buildValidationRules(this.profile);
  }

  getPublishPolicy() {
    return buildPublishPolicy(this.profile, {
      publishGeolocationCheck: resolvePublishGeolocationCheck(this.profile),
    });
  }

  getFieldStripRules() {
    return buildFieldStripRules(this.profile, {
      appliesDenaliSingleDayLogisticsStrip: resolveDenaliSingleDayLogisticsStrip(this.profile),
    });
  }

  getWizardConfig() {
    return buildWizardConfig(this.profile);
  }

  getRequiredSubmitFields(): WorkspaceRequiredSubmitFields {
    const base = buildRequiredSubmitFields(this.profile);
    if (this.profile !== "denali_pilot") {
      return base;
    }
    return {
      ...base,
      readSubmitFieldValue(
        dto: ProfileRequiredSubmitShape,
        path: WizardSubmitRequiredFieldPath,
      ): unknown {
        if (path === "logistics.primaryTransportMode") {
          const logistics = dto.tripDetails?.logistics as
            | { primaryTransportMode?: string | null }
            | undefined;
          return denaliPrimaryTransportSubmitValue({
            primaryTransportMode: logistics?.primaryTransportMode,
            rootTransportModes: dto.transportModes,
          });
        }
        return readDefaultSubmitFieldValue(dto, path);
      },
    };
  }
}
