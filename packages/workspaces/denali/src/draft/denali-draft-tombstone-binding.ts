import { topLevelRootsRemoved, type WorkspaceDraftTombstoneBinding } from "@app-tour/workspace-sdk";

import { DENALI_CANONICAL_OBJECT_ROOTS } from "../denali-plugin-adapter";

export const denaliDraftTombstoneBinding: WorkspaceDraftTombstoneBinding = {
  resolveTombstoneRoots(baselineForm, incomingForm) {
    return topLevelRootsRemoved(baselineForm, incomingForm, DENALI_CANONICAL_OBJECT_ROOTS);
  },
};
