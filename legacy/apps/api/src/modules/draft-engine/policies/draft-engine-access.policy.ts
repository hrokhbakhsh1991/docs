import type { CheckAbilitiesContext } from "../../../common/casl/check-abilities.decorator";

/** Injectable draft-engine authorization policy (keeps controllers free of domain subjects like `Tour`). */
export type DraftEngineAccessPolicy = (_ctx: CheckAbilitiesContext) => boolean;

export const DRAFT_ENGINE_ACCESS_POLICY = Symbol("DRAFT_ENGINE_ACCESS_POLICY");
