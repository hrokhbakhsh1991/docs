/**
 * Parallel `node --test` workers each boot Nest; a fixed port causes collisions and flaky ECONNRESET.
 * `TEST_API_PORT` overrides for debugging.
 */
export function assignTestApiPort(): void {
  const explicit = process.env.TEST_API_PORT;
  if (explicit && explicit.trim().length > 0) {
    process.env.PORT = explicit.trim();
    return;
  }
  process.env.PORT = String(30000 + (process.pid % 25000));
}
