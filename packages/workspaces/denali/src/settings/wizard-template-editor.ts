import {
  isDenaliFrozenTemplateCanonicalPath,
  normalizeDenaliWizardTemplatePayloadSteps,
} from "../index";
import {
  DENALI_WIZARD_PHOTOS_STEP_ID,
  isDenaliWizardTemplateLongDescriptionVisible,
  patchDenaliWizardTemplateLongDescriptionVisibility,
} from "./denali-wizard-template-long-description";
import {
  resolveDenaliWizardTemplateCatalogFieldMeta,
  resolveDenaliCompositeRendererIdForAnchor,
  type DenaliWizardTemplateCatalogFieldMeta,
} from "./denali-wizard-template-catalog-meta";

export type DenaliWizardTemplateEditorSurface = {
  readonly messageNamespace: "denali";
  readonly photosStepId: string;
  readonly isLongDescriptionVisible: (fieldRulesOverlay: unknown) => boolean;
  readonly patchLongDescriptionVisibility: (
    fieldRulesOverlay: Record<string, unknown> | undefined,
    visible: boolean
  ) => Record<string, unknown>;
  readonly resolveCatalogFieldMeta: (
    canonicalPath: string,
    stepId: string,
    stepFieldPaths: readonly string[]
  ) => DenaliWizardTemplateCatalogFieldMeta | null;
  readonly resolveCompositeRendererIdForAnchor: (anchorCanonicalPath: string) => string | null;
  readonly isFrozenTemplateCanonicalPath: (canonicalPath: string) => boolean;
  readonly normalizePublishedPayloadSteps: <T extends { published?: boolean }>(payload: T) => T;
};

export const denaliWizardTemplateEditor: DenaliWizardTemplateEditorSurface = Object.freeze({
  messageNamespace: "denali",
  photosStepId: DENALI_WIZARD_PHOTOS_STEP_ID,
  isLongDescriptionVisible: (fieldRulesOverlay: unknown) =>
    isDenaliWizardTemplateLongDescriptionVisible(
      fieldRulesOverlay as Readonly<Record<string, unknown>> | undefined
    ),
  patchLongDescriptionVisibility: patchDenaliWizardTemplateLongDescriptionVisibility,
  resolveCatalogFieldMeta: resolveDenaliWizardTemplateCatalogFieldMeta,
  resolveCompositeRendererIdForAnchor: resolveDenaliCompositeRendererIdForAnchor,
  isFrozenTemplateCanonicalPath: isDenaliFrozenTemplateCanonicalPath,
  normalizePublishedPayloadSteps<T extends { published?: boolean }>(payload: T): T {
    if (payload.published !== true) {
      return payload;
    }
    return normalizeDenaliWizardTemplatePayloadSteps(payload);
  },
});
