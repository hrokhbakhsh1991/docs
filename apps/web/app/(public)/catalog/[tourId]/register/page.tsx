import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { fetchUrbanCatalogTour } from "@/urban/urban-catalog-client";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { UrbanRegistrationForm } from "./urban-registration-form";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly params: Promise<{ readonly tourId: string }>;
  readonly searchParams: Promise<{ readonly submitted?: string }>;
};

export default async function UrbanCatalogRegisterPage({ params, searchParams }: PageProps) {
  const { tourId } = await params;
  const query = await searchParams;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const { context } = resolveBootstrapAppSessionForHost(host);
  const tour = await fetchUrbanCatalogTour(context.tenantId, tourId);

  if (tour === null) {
    notFound();
  }

  return (
    <main data-urban-registration-page>
      <h1>Register — {tour.title ?? "Tour"}</h1>
      <UrbanRegistrationForm
        tenantId={context.tenantId}
        tourId={tourId}
        submitted={query.submitted === "1"}
      />
      <p>
        <a href={`/catalog/${tourId}`}>Back to tour</a>
      </p>
    </main>
  );
}
