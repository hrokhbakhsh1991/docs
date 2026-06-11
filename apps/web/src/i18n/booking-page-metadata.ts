import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export type BookingMetadataSection = "list" | "create" | "leaderReview";

export async function buildBookingPageMetadata(section: BookingMetadataSection): Promise<Metadata> {
  const t = await getTranslations(`bookings.metadata.${section}`);
  return {
    title: t("title"),
    description: t("description"),
  };
}
