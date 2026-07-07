import { resolveMarketingPublicOrigin } from "./build-marketing-metadata";

export type MarketingLayoutJsonLd = Readonly<{
  readonly "@context": "https://schema.org";
  readonly "@graph": readonly (
    | Readonly<{
      readonly "@type": "Organization";
      readonly name: string;
      readonly url: string;
    }>
    | Readonly<{
      readonly "@type": "WebSite";
      readonly name: string;
      readonly url: string;
    }>
  )[];
}>;

export function buildMarketingLayoutJsonLd(input: {
  readonly host: string;
  readonly siteName: string;
}): MarketingLayoutJsonLd {
  const origin = resolveMarketingPublicOrigin(input.host);
  return Object.freeze({
    "@context": "https://schema.org",
    "@graph": Object.freeze([
      Object.freeze({
        "@type": "Organization",
        name: input.siteName,
        url: origin,
      }),
      Object.freeze({
        "@type": "WebSite",
        name: input.siteName,
        url: origin,
      }),
    ]),
  });
}
