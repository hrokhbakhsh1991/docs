import type { AppAbility } from "@repo/shared";

import type { CreateTourDto } from "../dto/create-tour.dto";
import { assertTourCreateAbilities } from "./assert-tour-mutation-abilities";

export type TourCreateWritePipelineContext = {
  ability: AppAbility;
  dto: CreateTourDto;
};

/**
 * Frozen tour CREATE write pipeline (Phase 5.3 — prompt.md):
 *
 * 1. CASL route guards — before handler
 * 2. Capability check — {@link assertTourCreateAbilities} (incl. publish when OPEN)
 * 3. Profile invariants + publish gates — service (`createTour`)
 * 4. Save — service persistence
 *
 * PATCH uses {@link assertTourPatchWritePreMerge} (adds patch field policy).
 */
export function assertTourCreateWritePreMerge(ctx: TourCreateWritePipelineContext): void {
  assertTourCreateAbilities(ctx.ability, ctx.dto);
}
