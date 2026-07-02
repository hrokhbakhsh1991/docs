import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

export function resolveMemberProfileErrorMessage(
  t: TranslateFn,
  code: string | null | undefined
): string {
  const resolved = resolveCodedErrorMessage((key) => t(`errors.${key}`), code);
  if (resolved.length > 0) {
    return resolved;
  }
  return t("failed");
}
