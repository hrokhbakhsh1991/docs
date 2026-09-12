/** Read a safe public organizer link from a persisted tour canonical document. */
export function readTourSocialMediaLink(canonical: unknown): string | null {
  if (canonical === null || typeof canonical !== "object" || Array.isArray(canonical)) {
    return null;
  }
  const record = canonical as Record<string, unknown>;
  const basicInfo = record.basicInfo;
  const basicInfoRecord =
    basicInfo !== null && typeof basicInfo === "object" && !Array.isArray(basicInfo)
      ? (basicInfo as Record<string, unknown>)
      : null;
  const raw = record.socialMediaLink ?? basicInfoRecord?.socialMediaLink;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }
  try {
    const url = new URL(raw.trim().includes("://") ? raw.trim() : `https://${raw.trim()}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}
