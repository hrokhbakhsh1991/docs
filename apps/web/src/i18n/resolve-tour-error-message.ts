type TranslateFn = (key: string) => string;

/** Maps stable error codes to localized copy when a matching key exists. */
export function resolveTourErrorMessage(
  t: TranslateFn,
  code: string | null | undefined
): string | null {
  if (code === null || code === undefined || code.trim().length === 0) {
    return null;
  }
  const key = code.startsWith("TOUR_") ? code : `TOUR_${code}`;
  try {
    return t(key);
  } catch {
    return code;
  }
}
