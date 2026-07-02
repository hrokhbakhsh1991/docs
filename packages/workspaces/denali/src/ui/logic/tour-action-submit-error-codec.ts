export const TOUR_ACTION_SUBMIT_ERROR_PREFIX = "TOUR_ACTION_ERROR:" as const;

export type TourActionSubmitErrorPayload = {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly correlationId?: string;
};

export function encodeTourActionSubmitError(payload: TourActionSubmitErrorPayload): string {
  return `${TOUR_ACTION_SUBMIT_ERROR_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeTourActionSubmitError(raw: string): TourActionSubmitErrorPayload | null {
  if (!raw.startsWith(TOUR_ACTION_SUBMIT_ERROR_PREFIX)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      raw.slice(TOUR_ACTION_SUBMIT_ERROR_PREFIX.length)
    ) as TourActionSubmitErrorPayload;
    if (
      parsed == null ||
      typeof parsed !== "object" ||
      typeof parsed.status !== "number" ||
      typeof parsed.code !== "string" ||
      typeof parsed.message !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isTourActionSubmitError(raw: string): boolean {
  return raw.startsWith(TOUR_ACTION_SUBMIT_ERROR_PREFIX);
}
