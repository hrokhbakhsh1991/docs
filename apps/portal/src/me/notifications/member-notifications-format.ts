import type { LucideIcon } from "lucide-react";
import { Bell, CreditCard, MessageCircle, Ticket, Wallet } from "lucide-react";

export type NotificationSourceModule =
  | "ticketing"
  | "wallet"
  | "finance"
  | "engagement"
  | "booking"
  | string;

export function formatMemberNotificationDateTime(iso: string, locale: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return iso;
  }
  const date = new Date(parsed);
  if (locale.startsWith("fa")) {
    return new Intl.DateTimeFormat("fa-IR", {
      calendar: "persian",
      numberingSystem: "arabext",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatMemberNotificationRelativeTime(iso: string, locale: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return iso;
  }
  const deltaMs = parsed - Date.now();
  const deltaMinutes = Math.round(deltaMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale.startsWith("fa") ? "fa-IR" : locale, {
    numeric: "auto",
  });
  if (Math.abs(deltaMinutes) < 60) {
    return rtf.format(deltaMinutes, "minute");
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 48) {
    return rtf.format(deltaHours, "hour");
  }
  const deltaDays = Math.round(deltaHours / 24);
  return rtf.format(deltaDays, "day");
}

export function resolveNotificationSourceIcon(
  sourceModule: NotificationSourceModule,
  eventType: string
): LucideIcon {
  if (sourceModule === "wallet" || eventType.includes("wallet")) {
    return Wallet;
  }
  if (
    sourceModule === "finance" ||
    eventType.includes("payment") ||
    eventType.includes("receipt")
  ) {
    return CreditCard;
  }
  if (
    sourceModule === "ticketing" ||
    eventType.includes("ticket") ||
    eventType.includes("message")
  ) {
    return eventType.includes("message") ? MessageCircle : Ticket;
  }
  return Bell;
}

export function sanitizeNotificationTitle(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/u, "").trim();
}

export function resolveNotificationBodyForLocale(input: {
  readonly title: string;
  readonly body: string;
  readonly locale: string;
  readonly entityId: string | null;
  readonly ticketFallback: (ticketRef: string) => string;
  readonly genericFallback: string;
}): string {
  const body = input.body.trim();
  if (input.locale.startsWith("fa")) {
    if (body.length === 0) {
      return input.genericFallback;
    }
    const ticketMatch = /^Update on ticket\s+(.+)\.?$/i.exec(body);
    if (ticketMatch !== null) {
      const ticketRef = ticketMatch[1]?.trim() ?? input.entityId ?? "";
      if (ticketRef.length > 0) {
        return input.ticketFallback(ticketRef);
      }
    }
    if (/^update on /i.test(body) || /^ticket /i.test(body)) {
      return input.genericFallback;
    }
  }
  return body;
}
