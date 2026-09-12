import { NextResponse } from "next/server";

import { buildMemberTicketCategoriesBffPayload } from "@/me/tickets/member-tickets-bff.server";
import { localizeMemberTicketsBffError } from "@/me/tickets/classify-member-tickets-bff-error";
import { resolveMemberTicketCategoriesForHost } from "@/me/tickets/resolve-member-ticket-categories.server";
import {
  jsonTicketsError,
  resolveMemberTicketsRouteContext,
} from "@/me/tickets/member-tickets-route-context.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const context = await resolveMemberTicketsRouteContext(req);
  if (context instanceof NextResponse) {
    return context;
  }

  const resolved = await resolveMemberTicketCategoriesForHost(
    context.host,
    context.bootstrap.pluginId,
  );
  if (!resolved.ok) {
    return jsonTicketsError(
      resolved.code,
      404,
      localizeMemberTicketsBffError(resolved.code, resolved.code),
    );
  }

  return NextResponse.json(buildMemberTicketCategoriesBffPayload(resolved.categories), {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
