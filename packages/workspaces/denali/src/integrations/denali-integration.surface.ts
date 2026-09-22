import {
  validateIntegrationSurface,
  type WorkspaceCanonicalDeliveryProjectionInput,
  type WorkspaceIntegrationSurface,
} from "@app-tour/workspace-sdk";
import { getCanonicalValue } from "@app-tour/platform-core";

const DENALI_LOCATION_ZONES_FIELD_ID = "denali.location-zones";
const DENALI_LOCATION_ZONE_PATHS = ["startPoint", "summitPoint", "campPoint", "endPoint"] as const;
const DENALI_LOCATION_ZONE_OVERVIEW_PREFIX = "tripDetails.overview";

function coerceLocationDataToDeliveryString(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (label.length > 0) {
    return label;
  }
  const address = typeof record.address === "string" ? record.address.trim() : "";
  return address.length > 0 ? address : undefined;
}

function projectDenaliLocationZones(
  input: WorkspaceCanonicalDeliveryProjectionInput
): Readonly<Record<string, string>> {
  if (!input.eligibleFieldIds.includes(DENALI_LOCATION_ZONES_FIELD_ID)) {
    return {};
  }
  const labels: string[] = [];
  for (const zonePath of DENALI_LOCATION_ZONE_PATHS) {
    const fromRoot = coerceLocationDataToDeliveryString(getCanonicalValue(input.payload, zonePath));
    const value =
      fromRoot ??
      coerceLocationDataToDeliveryString(
        getCanonicalValue(input.payload, `${DENALI_LOCATION_ZONE_OVERVIEW_PREFIX}.${zonePath}`)
      );
    if (value !== undefined && !labels.includes(value)) {
      labels.push(value);
    }
  }
  return labels.length === 0 ? {} : { [DENALI_LOCATION_ZONES_FIELD_ID]: labels.join("، ") };
}

export const denaliIntegrationSurface = Object.freeze({
  manifestVersion: 1 as const,
  providers: [
    {
      id: "telegram",
      configFields: [
        { id: "groupName", kind: "string" as const, requiredOnCreate: false },
        { id: "channelId", kind: "string" as const, requiredOnCreate: false },
      ],
      credentialFields: [{ id: "botToken", kind: "secret" as const, requiredOnCreate: true }],
      defaultCapabilities: ["message.send"] as const,
      defaultEventPolicies: [
        { eventType: "TourPublished", enabled: true },
        { eventType: "member.registered", enabled: true },
        { eventType: "registration.created", enabled: true },
        { eventType: "registration.approved", enabled: true },
        { eventType: "receipt.submitted", enabled: true },
        { eventType: "receipt.approved", enabled: true },
        { eventType: "receipt.rejected", enabled: true },
        { eventType: "ticket.created", enabled: true },
        { eventType: "ticket.message.posted", enabled: true },
        { eventType: "ticket.internal_note.created", enabled: true },
        { eventType: "ticket.status.changed", enabled: true },
        { eventType: "ticket.resolved", enabled: true },
        { eventType: "ticket.reopened", enabled: true },
        { eventType: "ticket.assigned", enabled: true },
        { eventType: "ticket.priority.changed", enabled: true },
        { eventType: "ticket.closed", enabled: true },
      ],
      eventMappings: [
        { eventType: "TourPublished", capability: "message.send", topicKey: "registration" },
        {
          eventType: "member.registered",
          capability: "message.send",
          topicKey: "registration",
        },
        {
          eventType: "registration.created",
          capability: "message.send",
          topicKey: "registration",
        },
        {
          eventType: "registration.approved",
          capability: "message.send",
          topicKey: "registration",
        },
        {
          eventType: "receipt.submitted",
          capability: "message.send",
          topicKey: "receipts",
        },
        {
          eventType: "receipt.approved",
          capability: "message.send",
          topicKey: "receipts",
        },
        {
          eventType: "receipt.rejected",
          capability: "message.send",
          topicKey: "receipts",
        },
        {
          eventType: "ticket.created",
          capability: "message.send",
          topicKey: "tickets",
        },
        ...[
          "ticket.message.posted",
          "ticket.internal_note.created",
          "ticket.status.changed",
          "ticket.resolved",
          "ticket.reopened",
          "ticket.assigned",
          "ticket.priority.changed",
          "ticket.closed",
        ].map((eventType) => ({
          eventType,
          capability: "message.send" as const,
          topicKey: "tickets",
        })),
      ],
    },
  ],
  messageTemplates: {
    TourPublished: "Tour published: {{title}}",
    "member.registered":
      "عضو جدید دنالی\nنام: {{displayName}}\nشماره تماس: {{mobile}}\nتاریخ ثبت‌نام: {{registeredAt}}",
    "registration.created":
      "📝 ثبت‌نام جدید\n\n👤 نام: {{guestLabel}}\n🏕 تور: {{tourTitle}}\n📅 تاریخ حرکت: {{departureAt}}\n👥 تعداد نفرات: {{partySize}}\n🆔 شناسه ثبت‌نام: {{bookingId}}\n\n{{approvalPrompt}}",
    "registration.approved":
      "ثبت‌نام تأیید شد\nشناسه ثبت‌نام: {{bookingId}}\nتاریخ تأیید: {{approvedAt}}",
    "receipt.submitted":
      "فیش جدید برای بررسی\nشناسه ثبت‌نام: {{registrationId}}\nشناسه پرداخت: {{paymentId}}\nمبلغ قابل پرداخت: {{amount}} {{currency}}\nتاریخ ارسال: {{submittedAt}}",
    "receipt.approved":
      "فیش تأیید شد\nشناسه فیش: {{receiptId}}\nشناسه ثبت‌نام: {{registrationId}}\nتاریخ بررسی: {{reviewedAt}}",
    "receipt.rejected":
      "فیش رد شد\nشناسه فیش: {{receiptId}}\nشناسه ثبت‌نام: {{registrationId}}\nتاریخ بررسی: {{reviewedAt}}\nیادداشت: {{reviewNote}}",
    "ticket.created":
      "🎫 تیکت جدید برای بررسی\nشناسه: {{ticketCode}}\nموضوع: {{subject}}\nتاریخ ارسال: {{createdAt}}\n\nمتن تیکت:\n{{body}}\n\n↩️ برای پاسخ به کاربر، روی همین پیام Reply کنید.",
    "ticket.message.posted":
      "💬 پیام جدید در تیکت\nشناسه: {{ticketCode}}\nموضوع: {{subject}}\nوضعیت: {{status}}\nتاریخ ارسال: {{createdAt}}\n\nمتن پیام:\n{{body}}",
    "ticket.internal_note.created":
      "📝 یادداشت داخلی جدید در تیکت\nشناسه: {{ticketCode}}\nموضوع: {{subject}}\nتاریخ ارسال: {{createdAt}}\n\nمتن یادداشت:\n{{body}}",
    "ticket.status.changed":
      "وضعیت تیکت تغییر کرد\nشناسه: {{ticketId}}\nموضوع: {{subject}}\nوضعیت: {{status}}",
    "ticket.resolved": "تیکت حل شد\nشناسه: {{ticketId}}\nموضوع: {{subject}}",
    "ticket.reopened": "تیکت دوباره باز شد\nشناسه: {{ticketId}}\nموضوع: {{subject}}",
    "ticket.assigned": "تیکت تخصیص داده شد\nشناسه: {{ticketId}}\nموضوع: {{subject}}",
    "ticket.priority.changed":
      "اولویت تیکت تغییر کرد\nشناسه: {{ticketId}}\nموضوع: {{subject}}\nاولویت: {{priority}}",
    "ticket.closed": "تیکت بسته شد\nشناسه: {{ticketId}}\nموضوع: {{subject}}",
  },
  projectCanonicalDeliveryFields: projectDenaliLocationZones,
}) satisfies WorkspaceIntegrationSurface;

validateIntegrationSurface(denaliIntegrationSurface);

export function getDenaliIntegrationSurface(): WorkspaceIntegrationSurface {
  return denaliIntegrationSurface;
}
