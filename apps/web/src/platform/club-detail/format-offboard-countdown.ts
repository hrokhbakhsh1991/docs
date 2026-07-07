export function formatOffboardCountdown(scheduledDeletionAt: string | null): string {
  if (!scheduledDeletionAt) return "—";
  const ms = Date.parse(scheduledDeletionAt) - Date.now();
  if (Number.isNaN(ms)) return "—";
  if (ms <= 0) return "Eligible for purge";
  const days = Math.ceil(ms / 86400000);
  return `${days} day(s) until scheduled deletion`;
}
