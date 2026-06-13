import type { Metadata } from "next";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { fetchToursListServer } from "@/features/tours/fetch-tours-list.server";
import { parseTourListQuery } from "@/features/tours/query-model";
import { buildTourPageMetadata } from "@/i18n/tour-page-metadata";

import { OperatorToursPageClient } from "./tours-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildTourPageMetadata("list");
}

export const dynamic = "force-dynamic";

type OperatorToursPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toUrlSearchParams(
  params: Record<string, string | string[] | undefined>
): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        next.append(key, entry);
      }
    } else {
      next.set(key, value);
    }
  }
  return next;
}

export default async function OperatorToursPage({ searchParams }: OperatorToursPageProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const params = await searchParams;
  const query = parseTourListQuery(toUrlSearchParams(params));
  const initialToursList = await fetchToursListServer(query);

  return (
    <OperatorToursPageClient session={session} initialToursList={initialToursList} />
  );
}
