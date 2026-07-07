"use client";

import { groupFieldPresentations, type FieldPresentation } from "@app-tour/platform-core";
import { useMemo, useState } from "react";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const EXPOSURE_FIELD_CHECKLIST_TEST_IDS = {
  root: "exposure-field-checklist",
  empty: "exposure-field-checklist-empty",
  search: "exposure-field-checklist-search",
  groupSelectAll: "exposure-field-checklist-group-select-all",
  groupClear: "exposure-field-checklist-group-clear",
} as const;

export type ExposureFieldChecklistContext = {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
};

export type ExposureFieldChecklistField = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly adminLabel?: string;
  readonly adminDescription?: string;
  readonly group?: string;
  readonly icon?: string;
};

export type ExposureFieldChecklistLabels = {
  readonly searchPlaceholder: string;
  readonly selectAllInGroup: string;
  readonly clearGroup: string;
  readonly selectedOfTotal: string;
};

export type ExposureFieldChecklistProps = {
  readonly context: ExposureFieldChecklistContext;
  readonly fields: readonly ExposureFieldChecklistField[];
  readonly selectedFieldIds: readonly string[];
  readonly disabled?: boolean;
  readonly emptyLabel: string;
  readonly selectedSummary: string;
  readonly labels?: ExposureFieldChecklistLabels;
  readonly onFieldToggle: (fieldId: string, checked: boolean) => void;
};

function fieldMatchesQuery(
  field: ExposureFieldChecklistField,
  presentationLabel: string,
  query: string,
): boolean {
  if (query.length === 0) {
    return true;
  }
  const haystack = [
    field.id,
    field.canonicalPath,
    presentationLabel,
    field.adminDescription ?? "",
    field.group ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function ExposureFieldChecklist({
  context,
  fields,
  selectedFieldIds,
  disabled = false,
  emptyLabel,
  selectedSummary,
  labels,
  onFieldToggle,
}: ExposureFieldChecklistProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const groupedFields = useMemo(
    () =>
      groupFieldPresentations(
        fields.map((field) => ({
          id: field.id,
          canonicalPath: field.canonicalPath,
          adminLabel: field.adminLabel,
          adminDescription: field.adminDescription,
          group: field.group,
          icon: field.icon,
        })),
      ),
    [fields],
  );

  const filteredGroupedFields = useMemo((): Readonly<Record<string, readonly FieldPresentation[]>> => {
    if (normalizedQuery.length === 0) {
      return groupedFields;
    }
    const filtered: Record<string, readonly FieldPresentation[]> = {};
    for (const [group, groupFields] of Object.entries(groupedFields)) {
      const matches = groupFields.filter((field) =>
        fieldMatchesQuery(
          fields.find((candidate) => candidate.id === field.id) ?? {
            id: field.id,
            canonicalPath: field.id,
          },
          field.label,
          normalizedQuery,
        ),
      );
      if (matches.length > 0) {
        filtered[group] = matches;
      }
    }
    return filtered;
  }, [fields, groupedFields, normalizedQuery]);

  const visibleFieldCount = useMemo(
    () =>
      Object.values(filteredGroupedFields).reduce(
        (total, groupFields) => total + groupFields.length,
        0,
      ),
    [filteredGroupedFields],
  );

  if (fields.length === 0) {
    return (
      <p
        className="text-xs text-muted-foreground"
        data-testid={EXPOSURE_FIELD_CHECKLIST_TEST_IDS.empty}
      >
        {emptyLabel}
      </p>
    );
  }

  const summaryText =
    labels != null
      ? labels.selectedOfTotal
          .replace("{selected}", String(selectedFieldIds.length))
          .replace("{total}", String(fields.length))
      : selectedSummary;

  return (
    <div
      className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-3"
      data-audience={context.audience}
      data-surface={context.surface}
      data-testid={EXPOSURE_FIELD_CHECKLIST_TEST_IDS.root}
      data-trigger={context.trigger}
    >
      {labels != null ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            type="search"
            value={query}
            disabled={disabled}
            placeholder={labels.searchPlaceholder}
            className="h-9 max-w-md bg-background"
            data-testid={EXPOSURE_FIELD_CHECKLIST_TEST_IDS.search}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{summaryText}</p>
        </div>
      ) : null}

      {visibleFieldCount === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        Object.entries(filteredGroupedFields).map(([group, groupFields]) => (
          <div key={group} className="space-y-2 rounded-md border border-border/40 bg-background/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              {labels != null && !disabled ? (
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    data-testid={EXPOSURE_FIELD_CHECKLIST_TEST_IDS.groupSelectAll}
                    onClick={() => {
                      for (const field of groupFields) {
                        if (!selectedFieldIds.includes(field.id)) {
                          onFieldToggle(field.id, true);
                        }
                      }
                    }}
                  >
                    {labels.selectAllInGroup}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    data-testid={EXPOSURE_FIELD_CHECKLIST_TEST_IDS.groupClear}
                    onClick={() => {
                      for (const field of groupFields) {
                        if (selectedFieldIds.includes(field.id)) {
                          onFieldToggle(field.id, false);
                        }
                      }
                    }}
                  >
                    {labels.clearGroup}
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {groupFields.map((field) => (
                <label
                  key={field.id}
                  className="flex items-start gap-2 rounded-md border border-transparent px-1 py-1 text-sm hover:border-border/60 hover:bg-muted/30"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={selectedFieldIds.includes(field.id)}
                    disabled={disabled}
                    onChange={(event) => onFieldToggle(field.id, event.target.checked)}
                  />
                  <span className="min-w-0 leading-5">
                    <span>{field.label}</span>
                    {field.description ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {field.description}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))
      )}

      {labels === undefined ? (
        <p className="text-xs text-muted-foreground">{summaryText}</p>
      ) : null}
    </div>
  );
}
