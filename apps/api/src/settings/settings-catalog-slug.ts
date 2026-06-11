export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uniqueCatalogSlug(
  existingSlugs: readonly string[],
  baseSlug: string,
  fallback: string
): string {
  let slug = baseSlug.length > 0 ? baseSlug : fallback;
  let suffix = 1;
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug || fallback}-${suffix}`;
    suffix += 1;
  }
  return slug;
}
