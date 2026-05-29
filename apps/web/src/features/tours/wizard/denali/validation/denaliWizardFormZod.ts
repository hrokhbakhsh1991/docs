export {
  getDenaliWizardSubmitIssues,
  getDenaliWizardStepIssues,
  validateDenaliWizardForm,
  denaliTourCreateFormSchema,
} from "@repo/denali-domain";

/** @deprecated Use canonical schema on submit. Tests only. */
export { denaliTourCreateFormSchema as denaliTourCreateSchema } from "@repo/denali-domain";
