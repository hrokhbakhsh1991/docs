import { resolveMarketingPublicOrigin } from "./build-marketing-metadata";

export type EnrichMarketingStructuredDataInput = {
  readonly host: string;
  readonly tourId: string;
  readonly structuredData: Readonly<Record<string, unknown>>;
};

/** Add absolute canonical tour URL to workspace JSON-LD at marketing render time. */
export function enrichMarketingTourStructuredData(
  input: EnrichMarketingStructuredDataInput
): Readonly<Record<string, unknown>> {
  const origin = resolveMarketingPublicOrigin(input.host);
  const path = `/tours/${encodeURIComponent(input.tourId.trim())}`;
  return Object.freeze({
    ...input.structuredData,
    url: `${origin}${path}`,
  });
}
