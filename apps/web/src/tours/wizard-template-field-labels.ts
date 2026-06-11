import denaliFaWizard from "@app-tour/workspace-denali/messages/fa/wizard.json";

import {
  formatCanonicalPathToLabel,
  resolveDenaliFieldKindLabelFromMessages,
  resolveDenaliFieldLabelFromMessages,
  resolveDenaliStepLabelFromMessages,
  type DenaliWizardMessages,
} from "@/i18n/denali-wizard-labels";

export { formatCanonicalPathToLabel };

const DEFAULT_DENALI_MESSAGES = denaliFaWizard as DenaliWizardMessages;

export function resolveWizardTemplateFieldLabel(
  canonicalPath: string,
  pluginId?: string,
  messages: DenaliWizardMessages = DEFAULT_DENALI_MESSAGES
): string {
  if (pluginId === "denali") {
    return resolveDenaliFieldLabelFromMessages(messages, canonicalPath);
  }
  return formatCanonicalPathToLabel(canonicalPath);
}

export function formatWizardTemplateStepLabel(
  stepId: string,
  messages: DenaliWizardMessages = DEFAULT_DENALI_MESSAGES
): string {
  return resolveDenaliStepLabelFromMessages(messages, stepId);
}

export function formatWizardTemplateFieldKindLabel(
  kind: string,
  messages: DenaliWizardMessages = DEFAULT_DENALI_MESSAGES
): string {
  return resolveDenaliFieldKindLabelFromMessages(messages, kind);
}
