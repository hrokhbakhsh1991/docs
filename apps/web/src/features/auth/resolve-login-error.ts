import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

export function resolveLoginErrorMessage(t: TranslateFn, code: string | null | undefined): string {
  return resolveCodedErrorMessage((key) => t(`errors.${key}`), code);
}
