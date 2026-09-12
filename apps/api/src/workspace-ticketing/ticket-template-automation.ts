import {
  interpolateTicketTemplate,
  mapEventTypeToTemplateChannels,
  type TicketTemplateChannel,
  type TicketTemplateLocale,
  type TicketTemplateVariableContext,
} from "@app-tour/ticketing-core";

import {
  findEnabledTemplateForAutomation,
  hasTicketTemplateAutomationActivation,
  tryActivateTicketTemplateAutomation,
} from "./ticket-template.repository";

export type ApplyTicketTemplateAutomationInput = {
  readonly tenantId: string;
  readonly domainEventId: string;
  readonly eventType: string;
  readonly ticketId: string;
  readonly locale?: TicketTemplateLocale;
  readonly context: TicketTemplateVariableContext;
};

export type ApplyTicketTemplateAutomationResult = {
  readonly title: string | null;
  readonly body: string | null;
  readonly templateCode: string | null;
  readonly channel: TicketTemplateChannel | null;
};

function pickLocale(preferred?: TicketTemplateLocale): TicketTemplateLocale {
  return preferred === "fa" ? "fa" : "en";
}

export async function applyTicketTemplateAutomation(
  input: ApplyTicketTemplateAutomationInput,
): Promise<ApplyTicketTemplateAutomationResult> {
  const locale = pickLocale(input.locale);
  if (await hasTicketTemplateAutomationActivation(input.tenantId, input.domainEventId)) {
    return { title: null, body: null, templateCode: null, channel: null };
  }
  const channels = mapEventTypeToTemplateChannels(input.eventType);

  for (const channel of channels) {
    const template = await findEnabledTemplateForAutomation(input.tenantId, channel, locale);
    if (template === null) continue;

    const activated = await tryActivateTicketTemplateAutomation(input.tenantId, {
      domainEventId: input.domainEventId,
      templateCode: template.code,
      locale,
      channel,
      ticketId: input.ticketId,
    });
    if (!activated) {
      continue;
    }

    const escapeHtml = channel === "email";
    const context = { ...input.context, eventType: input.eventType };
    return {
      title: interpolateTicketTemplate(template.title, context, { escapeHtml }),
      body: interpolateTicketTemplate(template.body, context, { escapeHtml }),
      templateCode: template.code,
      channel,
    };
  }

  return { title: null, body: null, templateCode: null, channel: null };
}
