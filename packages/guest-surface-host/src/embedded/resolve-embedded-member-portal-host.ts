/**
 * PS-6 — embedded member portal host detection (DL-13, DL-16).
 * @see docs/phase-19/member-portal-shell/embedded-host-adapter.mdoc
 */

export type EmbeddedMemberPortalHost = "telegram";

const TELEGRAM_USER_AGENT_PATTERN = /Telegram/i;

function readSearchParam(
  searchParams: URLSearchParams | Readonly<Record<string, string>> | undefined,
  key: string
): string | null {
  if (searchParams === undefined) {
    return null;
  }
  if (searchParams instanceof URLSearchParams) {
    const value = searchParams.get(key);
    return value !== null && value.length > 0 ? value : null;
  }
  const value = searchParams[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isDevTelegramOverride(searchParams?: URLSearchParams | Readonly<Record<string, string>>): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  const override = readSearchParam(searchParams, "tgWebApp");
  return override === "1" || override === "true";
}

/** Returns host kind when running inside Telegram WebApp; null on normal browser. */
export function resolveEmbeddedMemberPortalHost(input?: {
  readonly userAgent?: string | null;
  readonly searchParams?: URLSearchParams | Readonly<Record<string, string>>;
}): EmbeddedMemberPortalHost | null {
  if (isDevTelegramOverride(input?.searchParams)) {
    return "telegram";
  }
  const userAgent = input?.userAgent?.trim() ?? "";
  if (userAgent.length > 0 && TELEGRAM_USER_AGENT_PATTERN.test(userAgent)) {
    return "telegram";
  }
  return null;
}

/** Whether portal shell should tag embedded host context for styling. */
export function isEmbeddedMemberPortalHost(
  hostKind: EmbeddedMemberPortalHost | null
): hostKind is EmbeddedMemberPortalHost {
  return hostKind !== null;
}
