export const MEMBER_RECEIPT_NOTE_HEADER_PREFIX = "utf8b64:";

export function encodeMemberReceiptNoteHeader(note: string): string {
  const bytes = new TextEncoder().encode(note);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  const base64Url = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${MEMBER_RECEIPT_NOTE_HEADER_PREFIX}${base64Url}`;
}

export function decodeMemberReceiptNoteHeader(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  if (!value.startsWith(MEMBER_RECEIPT_NOTE_HEADER_PREFIX)) {
    return value;
  }

  try {
    const base64Url = value.slice(MEMBER_RECEIPT_NOTE_HEADER_PREFIX.length);
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
