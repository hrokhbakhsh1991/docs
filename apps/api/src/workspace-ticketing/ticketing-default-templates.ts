import type { TicketTemplateChannel, TicketTemplateLocale } from "@app-tour/ticketing-core";

export type TicketingDefaultTemplateSeed = {
  readonly code: string;
  readonly title: string;
  readonly body: string;
  readonly channel: TicketTemplateChannel;
  readonly locale: TicketTemplateLocale;
  readonly enabled?: boolean;
};

export const DENALI_TICKETING_DEFAULT_TEMPLATES: readonly TicketingDefaultTemplateSeed[] = [
  {
    code: "reply_ack",
    title: "Acknowledgement",
    channel: "public_reply",
    locale: "en",
    body: "Thank you for contacting us about {{ticketSubject}}. We are reviewing your request.",
  },
  {
    code: "reply_ack",
    title: "تأیید دریافت",
    channel: "public_reply",
    locale: "fa",
    body: "بابت «{{ticketSubject}}» با ما در تماس بودید. درخواست شما در حال بررسی است.",
  },
  {
    code: "internal_triage",
    title: "Internal triage",
    channel: "internal_note",
    locale: "en",
    body: "Internal: triage ticket {{ticketId}} ({{priority}} / {{status}}).",
  },
  {
    code: "email_update",
    title: "Ticket update",
    channel: "email",
    locale: "en",
    body: "Update on ticket {{ticketSubject}} ({{status}}).",
  },
  {
    code: "email_update",
    title: "به‌روزرسانی تیکت",
    channel: "email",
    locale: "fa",
    body: "به‌روزرسانی برای «{{ticketSubject}}» — وضعیت: {{status}}.",
  },
  {
    code: "sms_brief",
    title: "SMS brief",
    channel: "sms",
    locale: "en",
    body: "Ticket {{ticketSubject}}: {{status}}",
  },
  {
    code: "sla_warning_notice",
    title: "SLA warning",
    channel: "sla_warning",
    locale: "en",
    body: "SLA warning ({{clock}}) for {{ticketSubject}}.",
  },
  {
    code: "sla_breach_notice",
    title: "SLA breach",
    channel: "sla_breach",
    locale: "en",
    body: "SLA breached ({{clock}}) for {{ticketSubject}}.",
  },
];

export function resolveTicketingDefaultTemplates(
  workspaceType: string,
): readonly TicketingDefaultTemplateSeed[] {
  const normalized = workspaceType.trim().toLowerCase();
  if (normalized === "denali") {
    return DENALI_TICKETING_DEFAULT_TEMPLATES;
  }
  return [];
}
