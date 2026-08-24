import type { WorkspaceTransportFieldRegistryFragment } from "@app-tour/workspace-sdk";

import { denaliRegistryPresentationFields } from "./denali-integration-field-presentation";
import {
  DENALI_TRANSPORT_MODE_CANONICAL_PATH,
  denaliTransportModeField,
} from "./denali-transport-tour-field-module";

/**
 * CW7-07 — workspace field-registry slice bound via manifest `fieldModule`.
 * Dependent transport leaves render inside denali.transport-mode composite (INV-WIZ-002).
 */
export const denaliTransportFieldRegistryFragment: WorkspaceTransportFieldRegistryFragment =
  Object.freeze({
    version: 1,
    fields: Object.freeze([
      Object.freeze({
        id: "denali.transport-mode",
        canonicalPath: DENALI_TRANSPORT_MODE_CANONICAL_PATH,
        stepId: denaliTransportModeField.stepId,
        kind: "enum" as const,
        required: denaliTransportModeField.ruleDefaults.required,
        tags: denaliTransportModeField.tags,
        enumOptions: [
          "organizer_vehicle",
          "bus",
          "minibus",
          "train",
          "shared_cars",
          "none",
        ] as const,
        ...denaliRegistryPresentationFields({
          id: "denali.transport-mode",
          canonicalPath: DENALI_TRANSPORT_MODE_CANONICAL_PATH,
          tags: denaliTransportModeField.tags,
        }),
      }),
    ]),
  });

export {
  DENALI_TRANSPORT_MODE_CANONICAL_PATH,
  denaliTransportFieldModule,
  denaliTransportModeField,
  denaliTransportDependentFields,
} from "./denali-transport-tour-field-module";
