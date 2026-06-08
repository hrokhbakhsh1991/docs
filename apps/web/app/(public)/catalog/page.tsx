import { headers } from "next/headers";

import { fetchUrbanCatalogList } from "@/urban/urban-catalog-client";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

export const dynamic = "force-dynamic";

export default async function UrbanCatalogPage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const { context } = resolveBootstrapAppSessionForHost(host);
  const items = await fetchUrbanCatalogList(context.tenantId);

  return (
    <main data-urban-public-catalog>
      <h1>Urban catalog</h1>
      {items.length === 0 ? (
        <p data-urban-catalog-empty>No published tours yet.</p>
      ) : (
        <ul data-urban-catalog-grid>
          {items.map((tour) => (
            <li key={tour.id} data-urban-catalog-card>
              <a href={`/catalog/${tour.id}`}>
                <strong>{tour.title ?? "Untitled tour"}</strong>
              </a>
              <p>
                {[tour.city, tour.venueName].filter(Boolean).join(" · ") || "—"}
              </p>
              {tour.catalogSummary ? <p>{tour.catalogSummary}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
