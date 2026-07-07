export type DomainSslBadgeInput = {
  readonly sslStatus: string;
  readonly sslExpiresAt: string | null;
};

export function domainSslDisplayBadge(input: DomainSslBadgeInput): {
  readonly label: string;
  readonly dataSslStatus: string;
} {
  if (input.sslStatus === "active" && input.sslExpiresAt) {
    const expires = Date.parse(input.sslExpiresAt);
    if (!Number.isNaN(expires) && expires < Date.now()) {
      return { label: "Expired", dataSslStatus: "expired" };
    }
  }
  if (
    input.sslStatus === "pending" ||
    input.sslStatus === "provisioning" ||
    input.sslStatus === "active" ||
    input.sslStatus === "failed"
  ) {
    const label = input.sslStatus.charAt(0).toUpperCase() + input.sslStatus.slice(1);
    return { label, dataSslStatus: input.sslStatus };
  }
  return { label: "Unknown", dataSslStatus: "unknown" };
}
