/** Dedicated execution failure for blocked outbound URL targets (SSRF firewall). */
export class EgressUrlForbiddenError extends Error {
  readonly code = "EGRESS_URL_FORBIDDEN";

  constructor(message: string) {
    super(message);
    this.name = "EgressUrlForbiddenError";
  }
}
