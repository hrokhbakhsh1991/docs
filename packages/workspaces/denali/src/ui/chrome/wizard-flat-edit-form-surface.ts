import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import {
  DenaliFlatEditForm,
  DENALI_FLAT_EDIT_TEST_IDS,
  type DenaliFlatEditFormProps,
} from "./denali-flat-edit-form";

export type DenaliWizardFlatEditFormSurface = {
  readonly FlatEditForm: typeof DenaliFlatEditForm;
  readonly testIds: typeof DENALI_FLAT_EDIT_TEST_IDS;
};

export type { DenaliFlatEditFormProps, DenaliTourWizardDraft };

export const denaliWizardFlatEditFormSurface: DenaliWizardFlatEditFormSurface = Object.freeze({
  FlatEditForm: DenaliFlatEditForm,
  testIds: DENALI_FLAT_EDIT_TEST_IDS,
});
