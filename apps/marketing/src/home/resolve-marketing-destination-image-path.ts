/** Maps manifest destination slug to static marketing image under /public/home/destinations. */
const COMPACT_DESTINATION_IMAGE_STEMS: Readonly<Record<string, string>> = {
  alborz: "alborz-480",
  damavand: "damavand-480",
};

export function resolveMarketingDestinationImagePath(
  slug: string,
  imageStems: Readonly<Record<string, string>> = {}
): string {
  const normalizedSlug = slug.trim();
  const stem = imageStems[normalizedSlug]?.trim() || normalizedSlug;
  return `/home/destinations/${stem}.webp`;
}

export function resolveMarketingDestinationImageSrcSet(
  slug: string,
  imageStems: Readonly<Record<string, string>> = {}
): string | undefined {
  const normalizedSlug = slug.trim();
  const stem = imageStems[normalizedSlug]?.trim() || normalizedSlug;
  const compactStem = COMPACT_DESTINATION_IMAGE_STEMS[normalizedSlug];
  const sourceWidth = normalizedSlug === "alborz" ? 1200 : 960;

  if (compactStem === undefined || stem !== normalizedSlug) {
    return undefined;
  }

  const mediumStem = `${normalizedSlug}-720`;
  const retinaStem = `${normalizedSlug}-800`;
  return `/home/destinations/${compactStem}.webp 480w, /home/destinations/${mediumStem}.webp 720w, /home/destinations/${retinaStem}.webp 800w, /home/destinations/${stem}.webp ${sourceWidth}w`;
}
