import { getLocale, getTranslations } from "next-intl/server";

const BOOKING_STATUSES = [
  "pending",
  "approved",
  "waitlisted",
  "rejected",
  "cancelled",
] as const;

const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;

function translateKnownKey(
  translate: (key: string) => string,
  value: string,
  known: readonly string[]
): string {
  return known.includes(value) ? translate(value) : value;
}

export async function formatMemberRegistrationDeparture(iso: string): Promise<string> {
  const locale = await getLocale();
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

export async function localizeMemberRegistrationStatus(status: string): Promise<string> {
  const t = await getTranslations("portalMember.registrations.statusLabels");
  return translateKnownKey((key) => t(key), status, BOOKING_STATUSES);
}

export async function localizeMemberPaymentStatus(
  paymentStatus: string
): Promise<string> {
  const t = await getTranslations("portalMember.registrations.paymentStatusLabels");
  return translateKnownKey((key) => t(key), paymentStatus, PAYMENT_STATUSES);
}
