export type MarketingTourDetailJsonLdGraphInput = {
  readonly structuredData: Readonly<Record<string, unknown>> | null;
  readonly breadcrumbJsonLd: Readonly<Record<string, unknown>>;
};

/** Bundle tour structured data + breadcrumb into a single Schema.org @graph script. */
export function buildMarketingTourDetailJsonLdGraph(
  input: MarketingTourDetailJsonLdGraphInput
): Readonly<Record<string, unknown>> | null {
  const nodes: Readonly<Record<string, unknown>>[] = [];

  if (input.structuredData != null) {
    nodes.push(input.structuredData);
  }
  nodes.push(input.breadcrumbJsonLd);

  if (nodes.length === 0) {
    return null;
  }

  if (nodes.length === 1) {
    return nodes[0] ?? null;
  }

  return Object.freeze({
    "@context": "https://schema.org",
    "@graph": Object.freeze(nodes),
  });
}
