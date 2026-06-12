const THEME_SWATCH_TONE_COUNT = 6;

export function themeDisplayInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "?";
  }
  const words = trimmed.split(/\s+/).filter((part) => part.length > 0);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.slice(0, 2);
  }
  return trimmed.slice(0, 2);
}

export function themeSwatchToneIndex(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index) * (index + 3)) % THEME_SWATCH_TONE_COUNT;
  }
  return hash;
}

export function themeSwatchToneClass(seed: string): string {
  return `denali-theme-picker__swatch--tone-${themeSwatchToneIndex(seed)}`;
}
