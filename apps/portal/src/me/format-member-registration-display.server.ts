import { getLocale, getTranslations } from "next-intl/server";
import { resolveMemberRegistrationDisplayStatus } from "@app-tour/workspace-sdk";

const BOOKING_STATUSES = ["pending", "approved", "waitlisted", "rejected", "cancelled"] as const;

const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
const MEMBER_PAYMENT_DISPLAY_STATUSES = [...PAYMENT_STATUSES, "waived"] as const;
export const MEMBER_REGISTRATION_DISPLAY_TIME_ZONE = "Asia/Tehran" as const;

function translateKnownKey(
  translate: (key: string) => string,
  value: string,
  known: readonly string[]
): string {
  return known.includes(value) ? translate(value) : value;
}

export function formatMemberRegistrationDepartureLabel(
  iso: string,
  locale: string,
  timeZone: string = MEMBER_REGISTRATION_DISPLAY_TIME_ZONE
): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(parsed));
}

export async function formatMemberRegistrationDeparture(iso: string): Promise<string> {
  return formatMemberRegistrationDepartureLabel(iso, await getLocale());
}

export async function localizeMemberRegistrationStatus(
  status: string,
  workspaceId: string
): Promise<string> {
  const semantic = resolveMemberRegistrationDisplayStatus(workspaceId, status);
  if (semantic !== undefined) {
    const t = await getTranslations("portalMember.registrations.displayStatusLabels");
    return t(semantic);
  }
  const t = await getTranslations("portalMember.registrations.statusLabels");
  return translateKnownKey((key) => t(key), status, BOOKING_STATUSES);
}

export async function localizeMemberPaymentStatus(
  paymentStatus: string,
  financialDisplayState?: string
): Promise<string> {
  const t = await getTranslations("portalMember.registrations.paymentStatusLabels");
  const displayStatus = financialDisplayState === "WAIVED" ? "waived" : paymentStatus;
  return translateKnownKey((key) => t(key), displayStatus, MEMBER_PAYMENT_DISPLAY_STATUSES);
}

export async function localizeMemberFinalizationStatus(
  registrationStatus: string,
  paymentStatus: string,
  paymentCollection?: "offline" | "free",
  financialDisplayState?: string,
  finalizationStatus: "not_final" | "finalized" = "not_final"
): Promise<string | null> {
  const statusKey = resolveMemberFinalizationStatusKey({
    registrationStatus,
    paymentStatus,
    paymentCollection,
    financialDisplayState,
    finalizationStatus,
  });
  if (statusKey === null) return null;
  const t = await getTranslations("portalMember.registrations");
  return t(`paymentProgress.${statusKey}`);
}

export function resolveMemberFinalizationStatusKey(input: {
  readonly registrationStatus: string;
  readonly paymentStatus: string;
  readonly paymentCollection?: "offline" | "free";
  readonly financialDisplayState?: string;
  readonly finalizationStatus?: "not_final" | "finalized";
}): "waived" | "partial" | "unpaid" | "finalizedOpenPayment" | "paid" | null {
  if (input.registrationStatus.trim().toLowerCase() !== "approved") return null;
  if (input.paymentCollection === "free" || input.financialDisplayState === "WAIVED") {
    return "waived";
  }
  if (
    input.finalizationStatus === "finalized" &&
    input.paymentStatus.trim().toLowerCase() !== "paid"
  ) {
    return "finalizedOpenPayment";
  }
  if (
    input.financialDisplayState === "PARTIALLY_PAID" ||
    input.paymentStatus.trim().toLowerCase() === "partial"
  ) {
    return "partial";
  }
  if (
    input.financialDisplayState === "UNPAID" ||
    input.paymentStatus.trim().toLowerCase() === "unpaid"
  ) {
    return "unpaid";
  }
  if (input.paymentStatus.trim().toLowerCase() === "paid") return "paid";
  return null;
}
