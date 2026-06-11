import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { buildBookingPageMetadata } from "@/i18n/booking-page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildBookingPageMetadata("leaderReview");
}

export const dynamic = "force-dynamic";

export default function LeaderReviewAliasPage() {
  redirect("/bookings?view=inbox_table&scope=leader");
}
