import { DenaliFlatEditPageView } from "../flat-edit";
import { DenaliFlatEditValidationList } from "./denali-flat-edit-validation-list";

export type DenaliWizardFlatEditPageSurface = {
  readonly FlatEditPageView: typeof DenaliFlatEditPageView;
  readonly FlatEditValidationList: typeof DenaliFlatEditValidationList;
};

export const denaliWizardFlatEditPageSurface: DenaliWizardFlatEditPageSurface = Object.freeze({
  FlatEditPageView: DenaliFlatEditPageView,
  FlatEditValidationList: DenaliFlatEditValidationList,
});
