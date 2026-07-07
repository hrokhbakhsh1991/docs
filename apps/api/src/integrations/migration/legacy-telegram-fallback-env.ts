/**
 * Reversible legacy Telegram dual-read gate.
 * Default true — preserves pre-backfill behavior and allows rollback after backfill.
 */
export function isLegacyTelegramFallbackEnabled(): boolean {
  const raw = process.env.LEGACY_TELEGRAM_FALLBACK_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw.length === 0) {
    return true;
  }
  return raw === "true" || raw === "1" || raw === "yes";
}
