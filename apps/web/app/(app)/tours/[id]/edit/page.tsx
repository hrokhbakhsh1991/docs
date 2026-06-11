import type { Metadata } from "next";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildTourPageMetadata } from "@/i18n/tour-page-metadata";

import { TourEditPageClient } from "./tour-edit-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildTourPageMetadata("edit");
}

export const dynamic = "force-dynamic";

type TourEditPageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function TourEditPage({ params }: TourEditPageProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  const { id } = await params;
  return <TourEditPageClient session={session} tourId={id} />;
}
