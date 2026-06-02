/**
 * Iran national identifier (کد ملی): 10 decimal digits including check digit per standard algorithm.
 * Input should be ASCII digits before calling {@link validateIranNationalIdChecksum}.
 */

const PERSIAN_ZERO = 0x06f0;
const ARABIC_INDIC_ZERO = 0x0660;

/** Keep only decimal digits after mapping Persian / Arabic-indic digits to ASCII. */
export function asciiDigitsFromNationalIdRaw(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) {
      continue;
    }
    if (cp >= PERSIAN_ZERO && cp <= PERSIAN_ZERO + 9) {
      out += String.fromCodePoint(0x30 + (cp - PERSIAN_ZERO));
      continue;
    }
    if (cp >= ARABIC_INDIC_ZERO && cp <= ARABIC_INDIC_ZERO + 9) {
      out += String.fromCodePoint(0x30 + (cp - ARABIC_INDIC_ZERO));
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      out += ch;
    }
  }
  return out;
}

export function validateIranNationalIdChecksum(digits10: string): boolean {
  if (!/^\d{10}$/.test(digits10)) {
    return false;
  }
  if (/^(\d)\1{9}$/.test(digits10)) {
    return false;
  }
  const d = digits10.split("").map((c) => Number(c));
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += d[i]! * (10 - i);
  }
  const r = sum % 11;
  const check = d[9]!;
  if (r < 2) {
    return check === r;
  }
  return check === 11 - r;
}
