export type TicketNotificationEventType =
  | "ticket.created"
  | "ticket.message.posted"
  | "ticket.status.changed"
  | "ticket.assigned"
  | "ticket.priority.changed"
  | "ticket.resolved"
  | "ticket.reopened"
  | "ticket.closed"
  | "ticket.internal_note.created"
  | "ticket.sla.warning"
  | "ticket.sla.breached"
  | "ticket.sla.escalated";

export type TicketNotificationCopy = {
  readonly title: string;
  readonly body: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly titleFa: string;
  readonly bodyFa: string;
};

export function buildTicketNotificationCopy(input: {
  readonly eventType: TicketNotificationEventType;
  readonly subject: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}): TicketNotificationCopy {
  const subject = input.subject.trim();
  switch (input.eventType) {
    case "ticket.created":
      return copy(
        "notification.ticket.created.title",
        "notification.ticket.created.body",
        "تیکت جدید ثبت شد",
        `تیکت «${subject}» ایجاد شد.`,
        "New ticket created",
        `Ticket "${subject}" was created.`,
      );
    case "ticket.message.posted":
      return copy(
        "notification.ticket.message.posted.title",
        "notification.ticket.message.posted.body",
        "پاسخ جدید",
        `پاسخ جدید برای «${subject}».`,
        "New reply",
        `New reply on "${subject}".`,
      );
    case "ticket.internal_note.created":
      return copy(
        "notification.ticket.internal_note.title",
        "notification.ticket.internal_note.body",
        "یادداشت داخلی",
        `یادداشت داخلی روی «${subject}».`,
        "Internal note",
        `Internal note on "${subject}".`,
      );
    case "ticket.status.changed": {
      const to = String(input.payload?.to ?? "");
      return copy(
        "notification.ticket.status.changed.title",
        "notification.ticket.status.changed.body",
        "وضعیت تیکت تغییر کرد",
        `وضعیت «${subject}» به ${to} تغییر کرد.`,
        "Ticket status changed",
        `Status of "${subject}" changed to ${to}.`,
      );
    }
    case "ticket.assigned":
      return copy(
        "notification.ticket.assigned.title",
        "notification.ticket.assigned.body",
        "تیکت ارجاع شد",
        `«${subject}» به شما ارجاع شد.`,
        "Ticket assigned",
        `"${subject}" was assigned to you.`,
      );
    case "ticket.priority.changed": {
      const to = String(input.payload?.to ?? input.payload?.priority ?? "");
      return copy(
        "notification.ticket.priority.changed.title",
        "notification.ticket.priority.changed.body",
        "اولویت تیکت تغییر کرد",
        `اولویت «${subject}» به ${to} تغییر کرد.`,
        "Ticket priority changed",
        `Priority of "${subject}" changed to ${to}.`,
      );
    }
    case "ticket.resolved":
      return copy(
        "notification.ticket.resolved.title",
        "notification.ticket.resolved.body",
        "تیکت حل شد",
        `«${subject}» حل‌شده علامت خورد.`,
        "Ticket resolved",
        `"${subject}" was marked resolved.`,
      );
    case "ticket.reopened":
      return copy(
        "notification.ticket.reopened.title",
        "notification.ticket.reopened.body",
        "تیکت دوباره باز شد",
        `«${subject}» دوباره باز شد.`,
        "Ticket reopened",
        `"${subject}" was reopened.`,
      );
    case "ticket.closed":
      return copy(
        "notification.ticket.closed.title",
        "notification.ticket.closed.body",
        "تیکت بسته شد",
        `«${subject}» بسته شد.`,
        "Ticket closed",
        `"${subject}" was closed.`,
      );
    case "ticket.sla.warning": {
      const clock = String(input.payload?.clock ?? "sla");
      return copy(
        "notification.ticket.sla.warning.title",
        "notification.ticket.sla.warning.body",
        "هشدار SLA",
        `مهلت ${clock} برای «${subject}» نزدیک است.`,
        "SLA warning",
        `${clock} SLA deadline is approaching for "${subject}".`,
      );
    }
    case "ticket.sla.breached": {
      const clock = String(input.payload?.clock ?? "sla");
      return copy(
        "notification.ticket.sla.breached.title",
        "notification.ticket.sla.breached.body",
        "نقض SLA",
        `مهلت ${clock} برای «${subject}» گذشته است.`,
        "SLA breached",
        `${clock} SLA deadline was missed for "${subject}".`,
      );
    }
    case "ticket.sla.escalated": {
      const level = String(input.payload?.escalationLevel ?? "");
      return copy(
        "notification.ticket.sla.escalated.title",
        "notification.ticket.sla.escalated.body",
        "تشدید SLA",
        `تیکت «${subject}» به سطح ${level} تشدید شد.`,
        "SLA escalated",
        `Ticket "${subject}" escalated to level ${level}.`,
      );
    }
    default:
      return copy(
        "notification.ticket.generic.title",
        "notification.ticket.generic.body",
        "به‌روزرسانی تیکت",
        `به‌روزرسانی روی «${subject}».`,
        "Ticket update",
        `Update on "${subject}".`,
      );
  }
}

function copy(
  titleKey: string,
  bodyKey: string,
  titleFa: string,
  bodyFa: string,
  title: string,
  body: string,
): TicketNotificationCopy {
  return { titleKey, bodyKey, titleFa, bodyFa, title, body };
}
