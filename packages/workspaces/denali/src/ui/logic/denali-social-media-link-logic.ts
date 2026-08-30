export type SocialMediaKind = "telegram" | "other";

const TELEGRAM_HOSTS = new Set(["t.me", "telegram.me", "telegram.dog"]);

/** Wizard-only marker: legacy drafts only. Stripped before tour submit. */
export const DENALI_SOCIAL_MEDIA_EXTERNAL_PENDING = "__denali_social_external_pending__";

export function isSocialMediaExternalPending(stored: string): boolean {
  return stored.trim() === DENALI_SOCIAL_MEDIA_EXTERNAL_PENDING;
}

/** @deprecated Kind toggle removed — kept for legacy callers/tests. */
export function detectSocialMediaKind(stored: string): SocialMediaKind {
  const trimmed = stored.trim();
  if (isSocialMediaExternalPending(trimmed)) {
    return "other";
  }
  if (trimmed.length === 0) {
    return "other";
  }
  return isTelegramSocialLink(trimmed) ? "telegram" : "other";
}

/** Optional field — satisfied when empty or a normalized URL is stored. */
export function isSocialMediaLinkWizardSatisfied(stored: string): boolean {
  const trimmed = stored.trim();
  if (trimmed.length === 0) {
    return true;
  }
  return !isSocialMediaExternalPending(trimmed);
}

export function stripSocialMediaLinkForSubmit(stored: string): string {
  if (isSocialMediaExternalPending(stored)) {
    return "";
  }
  return stored.trim();
}

export function formatSocialMediaLinkForReview(stored: string): string {
  const trimmed = stored.trim();
  if (trimmed.length === 0 || isSocialMediaExternalPending(trimmed)) {
    return "";
  }
  return trimmed;
}

export function isTelegramSocialLink(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (trimmed.startsWith("@")) {
    return true;
  }
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return TELEGRAM_HOSTS.has(url.hostname.replace(/^www\./i, "").toLowerCase());
  } catch {
    return /^\+?[a-zA-Z][\w+]{3,}$/.test(trimmed);
  }
}

/** @deprecated Kind toggle removed — kept for legacy tests. */
export function formatTelegramInputDisplay(stored: string): string {
  const trimmed = stored.trim();
  if (trimmed.length === 0) {
    return "";
  }
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const path = url.pathname.replace(/^\//, "");
    if (path.startsWith("+") || path.startsWith("joinchat/")) {
      return path.startsWith("+") ? path : `/${path}`;
    }
    return path.length > 0 ? `@${path.replace(/^@/, "")}` : "";
  } catch {
    return trimmed.startsWith("@") ? trimmed : `@${trimmed.replace(/^@/, "")}`;
  }
}

/** @deprecated Use {@link normalizeSocialMediaLink}. */
export function normalizeTelegramSocialLink(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "";
  }

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (TELEGRAM_HOSTS.has(host)) {
      const path = url.pathname.replace(/^\//, "");
      if (path.length === 0) {
        return "";
      }
      const [firstSegment = ""] = path.split("/");
      if (firstSegment.length === 0) {
        return "";
      }
      return `https://t.me/${firstSegment}${url.search}`;
    }
  } catch {
    // fall through to handle parsing
  }

  let handle = trimmed.replace(/^@/, "").replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "");
  handle = handle.split("/")[0] ?? "";
  handle = handle.split("?")[0] ?? "";
  if (handle.length === 0) {
    return "";
  }
  if (handle.startsWith("+") || handle.startsWith("joinchat")) {
    return `https://t.me/${handle}`;
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(handle)) {
    return "";
  }
  return `https://t.me/${handle}`;
}

/** @deprecated Use {@link normalizeSocialMediaLink}. */
export function normalizeExternalSocialLink(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "";
  }
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  return url.href;
}

/** Normalize operator-entered group/social URL (http/https). Empty input clears the field. */
export function normalizeSocialMediaLink(
  input: string
): { readonly ok: true; readonly value: string } | { readonly ok: false } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: "" };
  }
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false };
    }
    return { ok: true, value: url.href };
  } catch {
    return { ok: false };
  }
}

/** @deprecated Kind toggle removed — kept for legacy tests. */
export function normalizeSocialMediaLinkForKind(
  kind: SocialMediaKind,
  input: string
): { readonly ok: true; readonly value: string } | { readonly ok: false } {
  if (kind === "telegram") {
    const value = normalizeTelegramSocialLink(input);
    if (input.trim().length > 0 && value.length === 0) {
      return { ok: false };
    }
    return { ok: true, value };
  }
  const value = normalizeExternalSocialLink(input);
  if (value === null) {
    return { ok: false };
  }
  return { ok: true, value: value };
}
