import type { Metadata } from "next";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import {
  buildBookingsApiQuery,
  buildBookingsSummaryApiQuery,
  parseBookingsCommandCenterQuery,
} from "@/features/bookings/bookings-command-center-logic";
import {
  isAdminOrOwnerRole,
  resolveBookingsViewForRole,
} from "@/features/bookings/bookings-command-center-types";
import { fetchBookingsServerPrefetch } from "@/features/bookings/fetch-bookings-list.server";
import { resolveBookingOpsCapabilityForHub } from "@/features/bookings/booking-ops-panels";
import { resolveBookingsOpsActionChrome } from "@/features/bookings/bookings-ops-action-chrome";
import { buildBookingPageMetadata } from "@/i18n/booking-page-metadata";

import { BookingsPageClient } from "./bookings-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildBookingPageMetadata("list");
}

export const dynamic = "force-dynamic";

type OperatorBookingsPageProps = {
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

export default async function OperatorBookingsPage({ searchParams }: OperatorBookingsPageProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const params = await searchParams;
  const parsedQuery = parseBookingsCommandCenterQuery(toUrlSearchParams(params));
  const query = {
    ...parsedQuery,
    view: resolveBookingsViewForRole(session.role, parsedQuery.view),
  };
  const initialPrefetch = await fetchBookingsServerPrefetch(
    buildBookingsApiQuery(query),
    isAdminOrOwnerRole(session.role),
    buildBookingsSummaryApiQuery(query)
  );
  const opsManifest = await resolveBookingOpsCapabilityForHub(null, session.pluginId);
  const opsActions = resolveBookingsOpsActionChrome(opsManifest);

  return (
    <BookingsPageClient
      session={session}
      initialPrefetch={initialPrefetch}
      opsActions={opsActions}
    />
  );
}
