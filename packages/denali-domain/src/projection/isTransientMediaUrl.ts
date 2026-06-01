/** Headless guard: skip browser blob URLs that cannot persist to Postgres JSONB. */
export function isTransientMediaUrl(url: string | undefined | null): url is string {
  return typeof url === "string" && url.startsWith("blob:");
}
