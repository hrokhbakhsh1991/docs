/**
 * Phone/Telegram onboarding stores a deterministic placeholder in `users.email`
 * (see `AuthService.makeOnboardingEmailFromPhone`, Telegram link). Those addresses
 * use the reserved `.invalid` TLD and must not be shown as the user's contact email.
 */
export function isSyntheticIdentityPlaceholderEmail(email: string | null | undefined): boolean {
  if (email === null || email === undefined) {
    return false;
  }
  const t = email.trim().toLowerCase();
  return t.endsWith("@local.invalid");
}
