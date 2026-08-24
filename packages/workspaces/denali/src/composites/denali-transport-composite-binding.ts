import type { WorkspaceTransportWizardCompositeBinding } from "@app-tour/workspace-sdk";

import { DENALI_TRANSPORT_MODE_CANONICAL_PATH } from "../field-registry/denali-transport-tour-field-module";

/** CW7-07 — wizard composite metadata for manifest `workspaceTransport.wizardComposite`. */
export const denaliTransportModeCompositeBinding: WorkspaceTransportWizardCompositeBinding =
  Object.freeze({
    rendererId: "denali.transport-mode",
    canonicalPath: DENALI_TRANSPORT_MODE_CANONICAL_PATH,
    zodKind: "transportMode",
  });
