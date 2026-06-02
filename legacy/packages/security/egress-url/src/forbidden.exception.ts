/** Hard abort for SSRF firewall violations (control chars, blocked targets). */
export class ForbiddenException extends Error {
  readonly code = "EGRESS_URL_FORBIDDEN";

  constructor(message: string) {
    super(message);
    this.name = "ForbiddenException";
  }
}
