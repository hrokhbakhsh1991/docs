/** Accept Persian and Arabic-Indic digits without changing the order of a code. */
export function normalizeOtpDigits(value: string): string {
  return value
    .replace(/[۰-۹٠-٩]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/\D/g, "");
}
