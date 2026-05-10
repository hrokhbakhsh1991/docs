"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { useCallback, useMemo } from "react";

import type { SettingsDestinationDto } from "@/lib/settings-locations-client";
import { normalizeSortOrder, pickSortOrderDeltas } from "@/lib/sort-order";

import { Button, Checkbox, EmptyState } from "@tour/ui";

import panelStyles from "./locations-settings-panel.module.css";

type SettingsTranslate = (key: string, values?: Record<string, string>) => string;

function applyDestinationSortOrdersForRegion(
  all: SettingsDestinationDto[],
  regionId: string,
  reorderedSameRegion: SettingsDestinationDto[],
): SettingsDestinationDto[] {
  const orderMap = new Map(reorderedSameRegion.map((d, index) => [d.id, index]));
  return all.map((d) => {
    if (d.regionId !== regionId) {
      return d;
    }
    const next = orderMap.get(d.id);
    if (next === undefined) {
      return d;
    }
    return { ...d, sortOrder: next };
  });
}

function destinationTypeLabel(type: string | null | undefined, t: SettingsTranslate) {
  if (!type) {
    return "—";
  }
  const map: Record<string, string> = {
    CITY: t("locationsTypeCity"),
    MOUNTAIN: t("locationsTypeMountain"),
    LAKE: t("locationsTypeLake"),
    OTHER: t("locationsTypeOther"),
  };
  return map[type] ?? type;
}

type ReadOnlyDestinationRowProps = {
  destination: SettingsDestinationDto;
  regionLabel: string;
  t: SettingsTranslate;
};

function ReadOnlyDestinationRow({ destination, regionLabel, t }: ReadOnlyDestinationRowProps) {
  return (
    <li className={panelStyles.listItem}>
      <div className={panelStyles.listItemInner}>
        <div className={panelStyles.listItemMain}>
          <div>
            <strong>{destination.name}</strong>
            <span className={panelStyles.listItemMeta}>— {regionLabel}</span>
            <span className={panelStyles.listItemMeta}>{destinationTypeLabel(destination.type, t)}</span>
            <span className={panelStyles.listItemMeta}>
              {t("locationsOrderInList", { n: String(destination.sortOrder ?? 0) })}
            </span>
            {!destination.isActive ? (
              <span className={panelStyles.listItemBadge}>— {t("locationsInactiveBadge")}</span>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

type SortableDestinationRowProps = {
  destination: SettingsDestinationDto;
  regionLabel: string;
  t: SettingsTranslate;
  onEdit: (d: SettingsDestinationDto) => void;
  onDelete: (d: SettingsDestinationDto) => void;
  onToggleActive: (d: SettingsDestinationDto, next: boolean) => void;
  mutating: boolean;
};

function SortableDestinationRow({
  destination,
  regionLabel,
  t,
  onEdit,
  onDelete,
  onToggleActive,
  mutating,
}: SortableDestinationRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: destination.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : 1,
    position: "relative",
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <li ref={setNodeRef} style={style} className={panelStyles.listItem}>
      <div className={panelStyles.listItemInner}>
        <button
          type="button"
          className={panelStyles.dragHandle}
          aria-label={t("locationsDragHandleLabel")}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className={panelStyles.listItemMain}>
          <div>
            <strong>{destination.name}</strong>
            <span className={panelStyles.listItemMeta}>— {regionLabel}</span>
            <span className={panelStyles.listItemMeta}>{destinationTypeLabel(destination.type, t)}</span>
            <span className={panelStyles.listItemMeta}>
              {t("locationsOrderInList", { n: String(destination.sortOrder ?? 0) })}
            </span>
            {!destination.isActive ? <span className={panelStyles.listItemBadge}>— {t("locationsInactiveBadge")}</span> : null}
          </div>
          <div className={panelStyles.listItemActions}>
            <label
              className={panelStyles.listItemMeta}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Checkbox
                bare
                checked={destination.isActive}
                disabled={mutating}
                onChange={(e) => onToggleActive(destination, e.currentTarget.checked)}
                aria-label={t("locationsActiveLabel")}
              />
              <span>{t("locationsActiveLabel")}</span>
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(destination)} disabled={mutating}>
              {t("locationsEdit")}
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={() => void onDelete(destination)} disabled={mutating}>
              {t("locationsDeleteDestination")}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

export type DestinationSortableBlockProps = {
  regionId: string;
  regionTitle: string | null;
  hideWhenEmpty: boolean;
  allDestinations: SettingsDestinationDto[];
  regionNameById: Map<string, string>;
  reorderDestinations: (
    nextDestinations: SettingsDestinationDto[],
    patches: { id: string; sortOrder: number }[],
  ) => Promise<void>;
  showToast: (args: { type: "success" | "error"; message: string }) => void;
  t: SettingsTranslate;
  onEditDestination: (d: SettingsDestinationDto) => void;
  onRequestDeleteDestination: (d: SettingsDestinationDto) => void;
  onToggleDestinationActive: (d: SettingsDestinationDto, next: boolean) => void;
  destinationsMutating: boolean;
  readOnly: boolean;
};

export function DestinationSortableBlock({
  regionId,
  regionTitle,
  hideWhenEmpty,
  allDestinations,
  regionNameById,
  reorderDestinations,
  showToast,
  t,
  onEditDestination,
  onRequestDeleteDestination,
  onToggleDestinationActive,
  destinationsMutating,
  readOnly,
}: DestinationSortableBlockProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemsInRegion = useMemo(
    () =>
      allDestinations
        .filter((d) => d.regionId === regionId)
        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        ),
    [allDestinations, regionId],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (readOnly) {
        return;
      }
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const prevBucket = [...itemsInRegion];
      const oldIndex = prevBucket.findIndex((d) => d.id === active.id);
      const newIndex = prevBucket.findIndex((d) => d.id === over.id);
      if (oldIndex < 0 || newIndex < 0) {
        return;
      }
      const newBucket = arrayMove(prevBucket, oldIndex, newIndex);
      const patches = pickSortOrderDeltas(prevBucket, normalizeSortOrder(newBucket));
      const nextAll = applyDestinationSortOrdersForRegion(allDestinations, regionId, newBucket);
      void (async () => {
        try {
          await reorderDestinations(nextAll, patches);
          if (patches.length > 0) {
            showToast({ type: "success", message: t("locationsToastOrderUpdated") });
          }
        } catch (e) {
          showToast({
            type: "error",
            message: e instanceof Error ? e.message : t("locationsToastOrderUpdateFailed"),
          });
        }
      })();
    },
    [allDestinations, itemsInRegion, readOnly, regionId, reorderDestinations, showToast, t],
  );

  if (itemsInRegion.length === 0) {
    if (hideWhenEmpty) {
      return null;
    }
    return (
      <div className={panelStyles.destinationGroup}>
        {regionTitle ? <p className={panelStyles.destinationGroupTitle}>{regionTitle}</p> : null}
        <EmptyState
          embedded
          className={panelStyles.emptyState}
          title={t("locationsNoDestinationsInRegion")}
          description={t("locationsNoDestinationsInRegionHint")}
        />
      </div>
    );
  }

  return (
    <div className={panelStyles.destinationGroup}>
      {regionTitle ? <p className={panelStyles.destinationGroupTitle}>{regionTitle}</p> : null}
      {readOnly ? (
        <ul className={panelStyles.list}>
          {itemsInRegion.map((d) => (
            <ReadOnlyDestinationRow
              key={d.id}
              destination={d}
              regionLabel={regionNameById.get(d.regionId) ?? d.regionId}
              t={t}
            />
          ))}
        </ul>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={itemsInRegion.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <ul className={panelStyles.list}>
              {itemsInRegion.map((d) => (
                <SortableDestinationRow
                  key={d.id}
                  destination={d}
                  regionLabel={regionNameById.get(d.regionId) ?? d.regionId}
                  t={t}
                  onEdit={onEditDestination}
                  onDelete={onRequestDeleteDestination}
                  onToggleActive={onToggleDestinationActive}
                  mutating={destinationsMutating}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
