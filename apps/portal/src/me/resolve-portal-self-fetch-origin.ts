/** Server-side portal BFF self-fetch — loopback + ingress Host (PCMS-REG-01 / custom apex dev). */
export function resolvePortalSelfFetchOrigin(ingressHost: string): {
  readonly origin: string;
  readonly ingressHost: string;
} {
  const internal = process.env.PORTAL_INTERNAL_URL?.trim();
  if (internal !== undefined && internal.length > 0) {
    return { origin: internal.replace(/\/$/, ""), ingressHost };
  }

  if (process.env.NODE_ENV !== "production") {
    const port = process.env.PORTAL_DEV_PORT?.trim() || "3003";
    return { origin: `http://127.0.0.1:${port}`, ingressHost };
  }

  const protocol = "https";
  return { origin: `${protocol}://${ingressHost}`, ingressHost };
}
