/** Join class names; skip falsy values. No external dependency. */
export function cn(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}
