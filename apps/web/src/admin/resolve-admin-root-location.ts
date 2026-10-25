/** Build a browser-facing URL from the validated admin host, not the proxy's internal origin. */
export function resolveAdminRootLocation(input: {
  readonly pathname: string;
  readonly host: string;
  readonly forwardedProtocol: string | null;
  readonly requestProtocol: string;
}): string {
  const forwardedProtocol = input.forwardedProtocol?.trim().toLowerCase();
  const requestProtocol = input.requestProtocol.trim().toLowerCase().replace(/:$/, "");
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : requestProtocol === "http" || requestProtocol === "https"
        ? requestProtocol
        : "https";

  return new URL(input.pathname, `${protocol}://${input.host}`).toString();
}
