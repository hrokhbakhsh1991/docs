import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { fetchUrbanCatalogTour } from "@/urban/urban-catalog-client";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly params: Promise<{ readonly tourId: string }>;
};

export default async function UrbanCatalogTourPage({ params }: PageProps) {
  const { tourId } = await params;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const { context } = resolveBootstrapAppSessionForHost(host);
  const tour = await fetchUrbanCatalogTour(context.tenantId, tourId);

  if (tour === null) {
    notFound();
  }

  return (
    <main data-urban-catalog-tour-detail>
      <h1>{tour.title ?? "Tour"}</h1>
      <p>
        {[tour.city, tour.venueName, tour.startDate, tour.endDate].filter(Boolean).join(" · ")}
      </p>
      {tour.catalogSummary ? <p>{tour.catalogSummary}</p> : null}
      <p>
        <a href={`/catalog/${tourId}/register`}>Register</a>
      </p>
      <p>
        <a href="/catalog">Back to catalog</a>
      </p>
    </main>
  );
}
