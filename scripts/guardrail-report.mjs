/**
 * Shared stderr reporting for architecture guardrail scripts.
 * Ensures CI failures are observable (no silent exit 1).
 */

/**
 * @param {string} scriptName
 * @param {readonly (string | { toString(): string })[]} violations
 * @returns {never}
 */
export function reportAndExit(scriptName, violations) {
  if (!violations.length) {
    return;
  }
  console.error(`\n${scriptName}: ${violations.length} violation(s)\n`);
  for (const v of violations) {
    console.error(typeof v === "string" ? v : String(v));
  }
  console.error("");
  process.exit(1);
}

/**
 * @param {string} scriptName
 * @param {unknown} err
 * @returns {never}
 */
export function reportFatal(scriptName, err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n${scriptName}: fatal error\n  ${message}\n`);
  process.exit(2);
}
