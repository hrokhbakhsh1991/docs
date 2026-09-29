/** Sum authoritative per-registration payable amounts without client discount arithmetic. */
export function sumParticipantPayableMinor(
  previews: readonly { readonly payableMinor: string }[]
): string | null {
  if (previews.length === 0) {
    return null;
  }

  let total = 0n;
  for (const preview of previews) {
    const normalized = preview.payableMinor.trim();
    if (!/^\d+$/.test(normalized)) {
      return null;
    }
    total += BigInt(normalized);
  }
  return total.toString();
}
