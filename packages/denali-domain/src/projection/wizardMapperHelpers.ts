import type { CreateTourDtoWireLike } from "@repo/shared-contracts";

export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function trimToUndefined(value: string | null | undefined): string | undefined {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : undefined;
}

export function deriveShortDescription(
  shortDescription?: string,
  longDescription?: string,
): string | undefined {
  const shortText = trimToUndefined(shortDescription);
  if (shortText) return shortText;
  const longText = trimToUndefined(longDescription);
  if (!longText) return undefined;
  return longText.slice(0, 160).trim();
}

export function clampDurationToApiRange(days: number | undefined): number | undefined {
  if (days == null || !Number.isInteger(days)) return undefined;
  if (days < 1 || days > 60) return undefined;
  return days;
}

export function overviewTourThemeIdsFromWizard(
  mainTourThemeId: string | undefined,
  secondaryTourThemeIds: string[] | undefined,
): string[] | undefined {
  const main = trimToUndefined(mainTourThemeId);
  const mainOk = main && UUID_V4_RE.test(main) ? main : undefined;
  const secRaw = Array.isArray(secondaryTourThemeIds) ? secondaryTourThemeIds : [];
  const secOk = [...new Set(secRaw.filter((id) => UUID_V4_RE.test(id)).filter((id) => id !== mainOk))];
  const ordered = mainOk ? [mainOk, ...secOk] : secOk;
  return ordered.length > 0 ? ordered : undefined;
}

export type DenaliCreateTourPayloadProjection = CreateTourDtoWireLike;
