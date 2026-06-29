import type { FieldDefinition } from "./types";

export type FieldPresentation = {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly description?: string;
  readonly icon?: string;
};

export type FieldPresentationInput = Pick<
  FieldDefinition,
  "id" | "canonicalPath" | "adminLabel" | "adminDescription" | "group" | "icon"
>;

const DEFAULT_PRESENTATION_GROUP = "General";

const PRESENTATION_GROUP_ORDER = [
  "Location",
  "Pricing",
  "Schedule",
  "Media",
  "General",
] as const;

function humanizeCanonicalPathLabel(canonicalPath: string): string {
  const segment = canonicalPath.split(".").pop() ?? canonicalPath;
  const withoutIdSuffix = segment.endsWith("Id") ? segment.slice(0, -2) : segment;
  return withoutIdSuffix
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Maps a technical {@link FieldDefinition} into admin-facing presentation metadata.
 * Identity remains `id`; labels never expose raw canonical paths when `adminLabel` is set.
 */
export function resolveFieldPresentation(input: FieldPresentationInput): FieldPresentation {
  const label =
    input.adminLabel?.trim() ||
    humanizeCanonicalPathLabel(input.canonicalPath);
  const group = input.group?.trim() || DEFAULT_PRESENTATION_GROUP;
  const description = input.adminDescription?.trim();

  return {
    id: input.id,
    label,
    group,
    ...(description === undefined || description.length === 0 ? {} : { description }),
    ...(input.icon?.trim() ? { icon: input.icon.trim() } : {}),
  };
}

export function groupFieldPresentations(
  fields: readonly FieldPresentationInput[],
): Readonly<Record<string, readonly FieldPresentation[]>> {
  const grouped = new Map<string, FieldPresentation[]>();

  for (const field of fields) {
    const presentation = resolveFieldPresentation(field);
    const bucket = grouped.get(presentation.group) ?? [];
    bucket.push(presentation);
    grouped.set(presentation.group, bucket);
  }

  const orderedGroups = [
    ...PRESENTATION_GROUP_ORDER.filter((group) => grouped.has(group)),
    ...[...grouped.keys()]
      .filter((group) => !PRESENTATION_GROUP_ORDER.includes(group as (typeof PRESENTATION_GROUP_ORDER)[number]))
      .sort((left, right) => left.localeCompare(right)),
  ];

  const result: Record<string, readonly FieldPresentation[]> = {};
  for (const group of orderedGroups) {
    const entries = grouped.get(group);
    if (entries === undefined || entries.length === 0) {
      continue;
    }
    result[group] = [...entries].sort((left, right) => left.label.localeCompare(right.label));
  }

  return result;
}
