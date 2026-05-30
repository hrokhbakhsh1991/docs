import { Logger } from "@nestjs/common";
import {
  DEFAULT_TOUR_FORM_PROFILE,
  normalizeTourFormProfileInput,
  type TourFormProfile,
} from "@repo/types";
import type { Repository } from "typeorm";

import { WorkspaceTourWizardTemplateEntity } from "../entities/workspace-tour-wizard-template.entity";
import { WorkspaceTourCreationPresetEntity } from "../entities/workspace-tour-creation-preset.entity";

const logger = new Logger("resolveWorkspaceTourFormProfile");

export type WorkspaceTourFormProfileResolutionSource =
  | "workspace_template"
  | "workspace_template_missing"
  | "selected_preset";

export type ResolveWorkspaceTourFormProfileResult = {
  profile: TourFormProfile;
  source: WorkspaceTourFormProfileResolutionSource;
};

/**
 * Single authority for workspace form profile (map-phase P1.1).
 * Reads `workspace_tour_creation_presets` if presetId is provided,
 * otherwise falls back to `workspace_tour_wizard_templates.base_profile`.
 */
export async function resolveWorkspaceTourFormProfile(
  workspaceId: string,
  templatesRepo: Repository<WorkspaceTourWizardTemplateEntity>,
  presetsRepo: Repository<WorkspaceTourCreationPresetEntity>,
  presetId?: string | null,
): Promise<ResolveWorkspaceTourFormProfileResult> {
  if (presetId) {
    const preset = await presetsRepo.findOne({
      where: { id: presetId, workspaceId },
      select: { formProfile: true },
    });
    if (preset) {
      return {
        profile: normalizeTourFormProfileInput(preset.formProfile),
        source: "selected_preset",
      };
    }
  }

  const row = await templatesRepo.findOne({
    where: { workspaceId },
    select: { baseProfile: true },
  });

  if (!row) {
    logger.warn(
      `No workspace_tour_wizard_templates row for workspaceId=${workspaceId}; using ${DEFAULT_TOUR_FORM_PROFILE}. ` +
        "Provision scripts should call upsertWorkspaceWizardTemplate with the workspace profile (e.g. denali_pilot) — no factory preset JSON.",
    );
    return {
      profile: DEFAULT_TOUR_FORM_PROFILE,
      source: "workspace_template_missing",
    };
  }

  return {
    profile: normalizeTourFormProfileInput(row.baseProfile),
    source: "workspace_template",
  };
}
