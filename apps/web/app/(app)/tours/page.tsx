import type { Metadata } from "next";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildTourPageMetadata } from "@/i18n/tour-page-metadata";

import { OperatorToursPageClient } from "./tours-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildTourPageMetadata("list");
}

export const dynamic = "force-dynamic";

export default async function OperatorToursPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <OperatorToursPageClient session={session} />;
}
