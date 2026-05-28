import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "./generated/denaliCanonicalPathMap.generated";

const FORM_TO_CANONICAL_PATH: Record<string, string> = Object.fromEntries(
  Object.entries(DENALI_CANONICAL_TO_FORM_PATH_MAP).map(([canonical, formPath]) => [
    formPath,
    canonical,
  ]),
);

export function mapDenaliCanonicalToFormPath(path: string): string {
  return DENALI_CANONICAL_TO_FORM_PATH_MAP[path] ?? path;
}

/** RHF dot path → canonical rule path (for UI + step validation). */
export function mapFormPathToCanonical(path: string): string {
  return FORM_TO_CANONICAL_PATH[path] ?? path;
}
