/** Decode the ASCII-safe UTF-8 header while retaining compatibility with legacy ASCII clients. */
export function resolveMemberReceiptNoteHeaders(
  encodedHeader: string,
  legacyHeader: string
): string | null {
  if (encodedHeader.length === 0) {
    return legacyHeader;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(encodedHeader) || encodedHeader.length % 4 === 1) {
    return null;
  }

  try {
    const bytes = Buffer.from(encodedHeader, "base64url");
    const note = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return Buffer.from(note, "utf8").toString("base64url") === encodedHeader ? note : null;
  } catch {
    return null;
  }
}
