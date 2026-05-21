import { Logger } from "@nestjs/common";
import {
  DEFAULT_TOUR_FORM_PROFILE,
  normalizeTourFormProfileInput,
  type TourFormProfile,
} from "@repo/types";
import type { Repository } from "typeorm";

import { WorkspaceTourWizardTemplateEntity } from "./entities/workspace-tour-wizard-template.entity";

const logger = new Logger("resolveWorkspaceTourFormProfile");

export type WorkspaceTourFormProfileResolutionSource = "workspace_template" | "workspace_template_missing";

export type ResolveWorkspaceTourFormProfileResult = {
  profile: TourFormProfile;
  source: WorkspaceTourFormProfileResolutionSource;
};

/**
 * Single authority for workspace form profile (map-phase P1.1).
 * Reads `workspace_tour_wizard_templates.base_profile` only.
 */
export async function resolveWorkspaceTourFormProfile(
  workspaceId: string,
  templatesRepo: Repository<WorkspaceTourWizardTemplateEntity>,
): Promise<ResolveWorkspaceTourFormProfileResult> {
  const row = await templatesRepo.findOne({
    where: { workspaceId },
    select: { baseProfile: true },
  });

  if (!row) {
    logger.warn(
      `No workspace_tour_wizard_templates row for workspaceId=${workspaceId}; using ${DEFAULT_TOUR_FORM_PROFILE}`,
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
