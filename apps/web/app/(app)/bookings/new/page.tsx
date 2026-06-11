import type { Metadata } from "next";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildBookingPageMetadata } from "@/i18n/booking-page-metadata";

import { BookingsCreatePageClient } from "./bookings-create-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildBookingPageMetadata("create");
}

export const dynamic = "force-dynamic";

export default async function OperatorBookingsCreatePage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <BookingsCreatePageClient session={session} />;
}
