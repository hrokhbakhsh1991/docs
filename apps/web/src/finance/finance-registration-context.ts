export type FinanceRegistrationContext = {
  readonly registrationId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly memberDisplayName: string;
};

export function parseFinanceRegistrationContext(raw: unknown): FinanceRegistrationContext | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const registrationId = String(record.registrationId ?? "").trim();
  const tourId = String(record.tourId ?? "").trim();
  const tourTitle = String(record.tourTitle ?? "").trim();
  const memberDisplayName = String(record.memberDisplayName ?? "").trim();
  if (
    registrationId.length === 0 ||
    tourId.length === 0 ||
    tourTitle.length === 0 ||
    memberDisplayName.length === 0
  ) {
    return null;
  }
  return { registrationId, tourId, tourTitle, memberDisplayName };
}

/** Append optional registrationId filter to a finance BFF path (Phase B). */
export function withFinanceRegistrationQuery(
  path: string,
  registrationId: string | null | undefined
): string {
  const id = registrationId?.trim() ?? "";
  if (id.length === 0) {
    return path;
  }
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}registrationId=${encodeURIComponent(id)}`;
}
