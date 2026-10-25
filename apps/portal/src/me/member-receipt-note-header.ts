/** Encode UTF-8 note text for an HTTP header, whose values cannot contain Persian directly. */
export function encodeMemberReceiptNoteHeader(note: string): string {
  const bytes = new TextEncoder().encode(note);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
