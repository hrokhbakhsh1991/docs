type TranslateFn = (key: string) => string;

const STABLE_TOUR_ERROR_CODE = /^TOUR_[A-Z0-9_]+$/;

/** True when `value` is a stable i18n lookup key (not pre-localized copy). */
export function isStableTourErrorCode(value: string): boolean {
  return STABLE_TOUR_ERROR_CODE.test(value.trim());
}

/** Maps stable error codes to localized copy when a matching key exists. */
export function resolveTourErrorMessage(
  t: TranslateFn,
  code: string | null | undefined
): string | null {
  if (code === null || code === undefined || code.trim().length === 0) {
    return null;
  }
  const trimmed = code.trim();
  if (!isStableTourErrorCode(trimmed)) {
    return trimmed;
  }
  try {
    return t(trimmed);
  } catch {
    return trimmed;
  }
}
