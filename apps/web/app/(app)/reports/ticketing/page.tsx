import { notFound } from "next/navigation";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { canAccessTicketsInbox } from "@/features/tickets/operator-tickets-types";

import { TicketingReportsClient } from "./ticketing-reports-client";

export const dynamic = "force-dynamic";

export default async function TicketingReportsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null || !canAccessTicketsInbox(session.role)) {
    notFound();
  }
  return <TicketingReportsClient session={session} />;
}
