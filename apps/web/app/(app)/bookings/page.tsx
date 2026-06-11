import type { Metadata } from "next";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildBookingPageMetadata } from "@/i18n/booking-page-metadata";

import { BookingsPageClient } from "./bookings-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildBookingPageMetadata("list");
}

export const dynamic = "force-dynamic";

export default async function OperatorBookingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <BookingsPageClient session={session} />;
}
