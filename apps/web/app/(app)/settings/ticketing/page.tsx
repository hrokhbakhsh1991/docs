import { notFound } from "next/navigation";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { canAccessTicketsInbox } from "@/features/tickets/operator-tickets-types";

import { TicketingSettingsClient } from "./ticketing-settings-client";

export const dynamic = "force-dynamic";

export default async function TicketingSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null || !canAccessTicketsInbox(session.role)) {
    notFound();
  }
  return <TicketingSettingsClient session={session} />;
}
