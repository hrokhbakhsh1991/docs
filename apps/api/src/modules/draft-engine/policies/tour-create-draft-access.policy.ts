import { AbilityAction } from "../../../common/casl/ability-actions";
import type { DraftEngineAccessPolicy } from "./draft-engine-access.policy";

/**
 * Default policy for workspace members who may persist wizard drafts today.
 * Uses product capability grants (`tour.create`) without referencing CASL `Tour` in controllers.
 */
export const tourCreateDraftAccessPolicy: DraftEngineAccessPolicy = ({ ability }) =>
  ability.can(AbilityAction.Create, "Tour");
