import type { Metadata } from "next";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildTourPageMetadata } from "@/i18n/tour-page-metadata";

import { TourRegisterPageClient } from "./tour-register-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildTourPageMetadata("register");
}

export const dynamic = "force-dynamic";

type TourRegisterPageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function TourRegisterPage({ params }: TourRegisterPageProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  const { id } = await params;
  return <TourRegisterPageClient session={session} tourId={id} />;
}
