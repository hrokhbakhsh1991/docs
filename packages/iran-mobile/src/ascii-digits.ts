const PERSIAN_DIGIT_START = 0x06f0;
const ARABIC_INDIC_DIGIT_START = 0x0660;

/** Maps Persian / Arabic-Indic digits to Western ASCII 0-9. */
export function toAsciiDigits(text: string): string {
  let result = "";
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (code >= PERSIAN_DIGIT_START && code <= PERSIAN_DIGIT_START + 9) {
      result += String(code - PERSIAN_DIGIT_START);
      continue;
    }
    if (code >= ARABIC_INDIC_DIGIT_START && code <= ARABIC_INDIC_DIGIT_START + 9) {
      result += String(code - ARABIC_INDIC_DIGIT_START);
      continue;
    }
    result += character;
  }
  return result;
}
