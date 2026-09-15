import { getWorkspaceTicketingCapabilities } from "@app-tour/workspace-sdk/ticketing";

import { fetchTicketsUpstream } from "./fetch-tickets-upstream.server";
import type { MemberTicketCategoriesView } from "./member-tickets-bff.server";

export async function resolveMemberTicketCategoriesForHost(
  host: string,
  pluginId: string,
): Promise<
  | { readonly ok: true; readonly categories: MemberTicketCategoriesView }
  | { readonly ok: false; readonly code: "TICKET_MODULE_DISABLED" | "TICKETING_WORKSPACE_UNSUPPORTED" }
> {
  const capabilities = getWorkspaceTicketingCapabilities(pluginId);
  if (capabilities === null || !capabilities.memberCreate) {
    return { ok: false, code: "TICKETING_WORKSPACE_UNSUPPORTED" };
  }

  const probe = await fetchTicketsUpstream(host, "/member/tickets", { query: { limit: "1" } });
  if (!probe.ok) {
    const body = await probe.json().catch(() => ({}));
    const code =
      typeof body === "object" && body !== null && typeof (body as { code?: string }).code === "string"
        ? (body as { code: string }).code
        : "";
    if (probe.status === 404 && code === "TICKET_MODULE_DISABLED") {
      return { ok: false, code: "TICKET_MODULE_DISABLED" };
    }
    if (probe.status === 404) {
      return { ok: false, code: "TICKET_MODULE_DISABLED" };
    }
  }

  return {
    ok: true,
    categories: {
      defaultCategoryCode: capabilities.defaultCategoryCode,
      maxAttachmentSizeBytes: capabilities.maxAttachmentSizeBytes,
      attachmentsEnabled: capabilities.attachments,
      categories: [...capabilities.categories].sort((a, b) => a.sortOrder - b.sortOrder),
    },
  };
}
