import type { Metadata } from "next";

import { buildTourPageMetadata } from "@/i18n/tour-page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildTourPageMetadata("workspace");
}

/** Tab panels render in workspace layout client (keep-alive); page is a stable anchor. */
export default function TourWorkspacePage() {
  return null;
}
