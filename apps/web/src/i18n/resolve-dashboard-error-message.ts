import { resolveCodedErrorMessage } from "./resolve-coded-error-message";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

export function resolveDashboardErrorMessage(
  t: TranslateFn,
  code: string | null | undefined
): string | null {
  if (code === null || code === undefined || code.trim().length === 0) {
    return null;
  }
  const message = resolveCodedErrorMessage(t, code);
  return message.length > 0 ? message : code;
}
