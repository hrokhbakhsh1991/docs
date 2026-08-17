/** `/tours/{id}` with optional next-intl `as-needed` prefix (`/en/tours/{id}`). */
export function isMarketingTourDetailPathname(pathname: string): boolean {
  return /(?:^|\/)tours\/[^/]+\/?$/.test(pathname);
}
