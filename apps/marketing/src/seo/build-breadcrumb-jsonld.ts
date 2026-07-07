import { resolveMarketingPublicOrigin } from "./build-marketing-metadata";

export type TourDetailBreadcrumbInput = {
  readonly host: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly toursLabel: string;
  readonly homeLabel: string;
};

/** BreadcrumbList JSON-LD for tour detail (Home → Tours → title). */
export function buildTourDetailBreadcrumbJsonLd(
  input: TourDetailBreadcrumbInput
): Readonly<Record<string, unknown>> {
  const origin = resolveMarketingPublicOrigin(input.host);
  const toursUrl = `${origin}/tours`;
  const detailUrl = `${origin}/tours/${encodeURIComponent(input.tourId.trim())}`;

  return Object.freeze({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: Object.freeze([
      Object.freeze({
        "@type": "ListItem",
        position: 1,
        name: input.homeLabel,
        item: `${origin}/`,
      }),
      Object.freeze({
        "@type": "ListItem",
        position: 2,
        name: input.toursLabel,
        item: toursUrl,
      }),
      Object.freeze({
        "@type": "ListItem",
        position: 3,
        name: input.tourTitle,
        item: detailUrl,
      }),
    ]),
  });
}
