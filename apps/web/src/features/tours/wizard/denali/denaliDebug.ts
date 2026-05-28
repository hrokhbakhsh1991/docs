/** Diagnostic logger for Denali wizard state sync — filter the console with `DENALI-DEBUG`. */
export function denaliDebug(location: string, context: string, data?: unknown): void {
  if (data === undefined) {
    console.log(`[DENALI-DEBUG] ${location} | ${context}`);
    return;
  }
  console.log(`[DENALI-DEBUG] ${location} | ${context}:`, data);
}
