/**
 * Deep link opened from the app shell to start Telegram account linking (bot deep link).
 * Backend completion is wired separately; this URL is configurable per deployment.
 */
export function getTelegramSyncDeepLink(): string {
  const fromEnv = process.env.NEXT_PUBLIC_TELEGRAM_SYNC_DEEP_LINK?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return "https://t.me/your_bot?start=sync";
}
