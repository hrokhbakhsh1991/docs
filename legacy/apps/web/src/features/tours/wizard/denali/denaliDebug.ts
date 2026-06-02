/** Diagnostic logger for Denali wizard state sync — filter the console with `DENALI-DEBUG`. */
export function denaliDebug(_location: string, _context: string, data?: unknown): void {
  if (data === undefined) {
    return;
  }
}
