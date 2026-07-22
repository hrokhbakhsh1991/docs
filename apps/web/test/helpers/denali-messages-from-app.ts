/**
 * Test helper — map loaded app messages to DenaliWizardMessages (Wave F.d).
 * Production shell no longer hosts a Denali label barrel.
 */
import type { AppLocale } from "../src/i18n/routing";

import {
  isDenaliWizardMessages,
  type DenaliWizardMessages,
} from "@app-tour/workspace-denali/host/ui/adapters/field-labels-from-messages";

export type { DenaliWizardMessages };

export function denaliMessagesFromAppMessages(
  messages: Record<string, unknown>,
  locale: AppLocale
): DenaliWizardMessages {
  const denali = messages.denali;
  if (isDenaliWizardMessages(denali)) {
    return denali;
  }
  throw new Error(`DENALI_MESSAGES_MISSING_${locale}`);
}
