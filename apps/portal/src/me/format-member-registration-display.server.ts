import { getLocale, getTranslations } from "next-intl/server";
import {
  resolveMemberRegistrationDisplayStatus,
} from "@app-tour/workspace-sdk";

const BOOKING_STATUSES = [
  "pending",
  "approved",
  "waitlisted",
  "rejected",
  "cancelled",
] as const;

const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
const MEMBER_PAYMENT_DISPLAY_STATUSES = [...PAYMENT_STATUSES, "waived"] as const;

function translateKnownKey(
  translate: (key: string) => string,
  value: string,
  known: readonly string[],
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

export async function localizeMemberRegistrationStatus(
  status: string,
  workspaceId: string,
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
  financialDisplayState?: string,
): Promise<string> {
  const t = await getTranslations("portalMember.registrations.paymentStatusLabels");
  const displayStatus = financialDisplayState === "WAIVED" ? "waived" : paymentStatus;
  return translateKnownKey((key) => t(key), displayStatus, MEMBER_PAYMENT_DISPLAY_STATUSES);
}

export async function localizeMemberFinalizationStatus(
  registrationStatus: string,
  paymentStatus: string,
  financialDisplayState?: string,
): Promise<string | null> {
  if (registrationStatus.trim().toLowerCase() !== "approved") {
    return null;
  }
  const t = await getTranslations("portalMember.registrations");
  if (financialDisplayState === "WAIVED") {
    return t("paymentProgress.waived");
  }
  if (financialDisplayState === "PARTIALLY_PAID" || paymentStatus.trim().toLowerCase() === "partial") {
    return t("paymentProgress.partial");
  }
  if (financialDisplayState === "UNPAID" || paymentStatus.trim().toLowerCase() === "unpaid") {
    return t("paymentProgress.unpaid");
  }
  if (paymentStatus.trim().toLowerCase() === "paid") {
    return t("paymentProgress.paid");
  }
  return null;
}
