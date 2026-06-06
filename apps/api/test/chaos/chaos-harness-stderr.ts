/** LOG-COL-12 / DEC-042 — chaos subprocess stderr without tenant UUID or SQL text. */
export function emitChaosHarnessError(event: string, code: string): void {
  process.stderr.write(`${JSON.stringify({ event, code })}\n`);
}
