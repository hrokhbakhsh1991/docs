/** Maps manifest destination slug to static marketing image under /public/home/destinations. */
export function resolveMarketingDestinationImagePath(
  slug: string,
  imageStems: Readonly<Record<string, string>> = {}
): string {
  const normalizedSlug = slug.trim();
  const stem = imageStems[normalizedSlug]?.trim() || normalizedSlug;
  return `/home/destinations/${stem}.webp`;
}
