import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export type TourMetadataSection =
  | "list"
  | "edit"
  | "register"
  | "workspace"
  | "workspaceWaitlist"
  | "workspaceTransport";

export async function buildTourPageMetadata(section: TourMetadataSection): Promise<Metadata> {
  const t = await getTranslations(`tours.metadata.${section}`);
  return {
    title: t("title"),
    description: t("description"),
  };
}
