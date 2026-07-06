import { DenaliCreateTourWizardView } from "../create-wizard";

export type DenaliWizardCreateViewSurface = {
  readonly CreateTourWizardView: typeof DenaliCreateTourWizardView;
};

export const denaliWizardCreateViewSurface: DenaliWizardCreateViewSurface = Object.freeze({
  CreateTourWizardView: DenaliCreateTourWizardView,
});
