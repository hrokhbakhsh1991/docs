import { isDraftEssentiallyEmpty } from "../../wizard/resolve-initial-step-index";
import {
  useDenaliCreateTourWizardCore,
  type DenaliCreateTourWizardScreen,
} from "./use-create-tour-wizard-core";

export type DenaliWizardCreateChromeSurface = {
  readonly useCreateTourWizardCore: typeof useDenaliCreateTourWizardCore;
  readonly isDraftEssentiallyEmpty: typeof isDraftEssentiallyEmpty;
};

export type { DenaliCreateTourWizardScreen };

export const denaliWizardCreateChromeSurface: DenaliWizardCreateChromeSurface = Object.freeze({
  useCreateTourWizardCore: useDenaliCreateTourWizardCore,
  isDraftEssentiallyEmpty,
});
