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
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { useCallback, useMemo } from "react";

import type { SettingsRegionDto } from "@/lib/settings-locations-client";

import { Button, Checkbox } from "@tour/ui";

import panelStyles from "./locations-settings-panel.module.css";

type SortableRegionRowProps = {
  region: SettingsRegionDto;
  onEdit: (_r: SettingsRegionDto) => void;
  onDelete: (_r: SettingsRegionDto) => void;
  onToggleActive: (_r: SettingsRegionDto, _next: boolean) => void;
  mutating: boolean;
};

function SortableRegionRow({ region, onEdit, onDelete, onToggleActive, mutating }: SortableRegionRowProps) {
  const t = useTranslations("settings");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: region.id,
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
            <strong>{region.name}</strong>
            {region.country ? <span className={panelStyles.listItemMeta}>({region.country})</span> : null}
            <span className={panelStyles.listItemMeta}>
              {t("locationsOrderInList", { n: String(region.sortOrder ?? 0) })}
            </span>
            {!region.isActive ? <span className={panelStyles.listItemBadge}>— {t("locationsInactiveBadge")}</span> : null}
          </div>
          <div className={panelStyles.listItemActions}>
            <label
              className={panelStyles.listItemMeta}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Checkbox
                bare
                checked={region.isActive}
                disabled={mutating}
                onChange={(e) => onToggleActive(region, e.currentTarget.checked)}
                aria-label={t("locationsActiveLabel")}
              />
              <span>{t("locationsActiveLabel")}</span>
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(region)} disabled={mutating}>
              {t("locationsEdit")}
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={() => void onDelete(region)} disabled={mutating}>
              {t("locationsDeleteRegion")}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

export type RegionListProps = {
  items: SettingsRegionDto[];
  onEdit: (_item: SettingsRegionDto) => void;
  onDelete: (_item: SettingsRegionDto) => void;
  onToggleActive: (_item: SettingsRegionDto, _next: boolean) => void;
  onReorder: (_itemIds: string[]) => Promise<void>;
  mutating: boolean;
  readOnly?: boolean;
};

export function RegionList({
  items,
  onEdit,
  onDelete,
  onToggleActive,
  onReorder,
  mutating,
  readOnly = false,
}: RegionListProps) {
  const t = useTranslations("settings");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [items],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const oldIndex = sorted.findIndex((r) => r.id === active.id);
      const newIndex = sorted.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0) {
        return;
      }
      const newOrder = arrayMove(sorted, oldIndex, newIndex);
      const itemIds = newOrder.map((r) => r.id);
      const prevIds = sorted.map((r) => r.id);
      if (itemIds.every((id, i) => id === prevIds[i])) {
        return;
      }
      void onReorder(itemIds);
    },
    [onReorder, sorted],
  );

  if (readOnly) {
    return (
      <ul className={panelStyles.list}>
        {sorted.map((region) => (
          <li key={region.id} className={panelStyles.listItem}>
            <div className={panelStyles.listItemInner}>
              <div className={panelStyles.listItemMain}>
                <div>
                  <strong>{region.name}</strong>
                  {region.country ? <span className={panelStyles.listItemMeta}>({region.country})</span> : null}
                  <span className={panelStyles.listItemMeta}>
                    {t("locationsOrderInList", { n: String(region.sortOrder ?? 0) })}
                  </span>
                  {!region.isActive ? (
                    <span className={panelStyles.listItemBadge}>— {t("locationsInactiveBadge")}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sorted.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <ul className={panelStyles.list}>
          {sorted.map((region) => (
            <SortableRegionRow
              key={region.id}
              region={region}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              mutating={mutating}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
