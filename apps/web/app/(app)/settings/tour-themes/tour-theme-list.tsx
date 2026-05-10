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

import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";

import { Button, Checkbox } from "@tour/ui";

import panelStyles from "../locations/locations-settings-panel.module.css";

const DESCRIPTION_PREVIEW_MAX = 120;

function previewDescription(text: string | null | undefined): string {
  if (!text?.trim()) {
    return "—";
  }
  const t = text.trim();
  return t.length > DESCRIPTION_PREVIEW_MAX ? `${t.slice(0, DESCRIPTION_PREVIEW_MAX)}…` : t;
}

type SortableTourThemeRowProps = {
  item: SettingsTourThemeDto;
  onEdit: (item: SettingsTourThemeDto) => void;
  onDelete: (item: SettingsTourThemeDto) => void;
  onToggleActive: (item: SettingsTourThemeDto, next: boolean) => void;
  mutating: boolean;
};

function SortableTourThemeRow({
  item,
  onEdit,
  onDelete,
  onToggleActive,
  mutating,
}: SortableTourThemeRowProps) {
  const t = useTranslations("settings");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
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
          aria-label={t("tourThemesDragHandleLabel")}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className={panelStyles.listItemMain}>
          <div>
            <strong>{item.name}</strong>
            <span className={panelStyles.listItemMeta}>{previewDescription(item.description)}</span>
            <span className={panelStyles.listItemMeta}>
              {t("tourThemesSortOrderLabel", { n: String(item.sortOrder) })}
            </span>
            {!item.isActive ? <span className={panelStyles.listItemBadge}>— {t("tourThemesInactiveBadge")}</span> : null}
          </div>
          <div className={panelStyles.listItemActions}>
            <label
              className={panelStyles.listItemMeta}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Checkbox
                bare
                checked={item.isActive}
                disabled={mutating}
                onChange={(e) => onToggleActive(item, e.currentTarget.checked)}
                aria-label={t("tourThemesFieldActive")}
              />
              <span>{t("tourThemesFieldActive")}</span>
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(item)} disabled={mutating}>
              {t("tourThemesEdit")}
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={() => void onDelete(item)} disabled={mutating}>
              {t("tourThemesDelete")}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

export type TourThemeListProps = {
  items: SettingsTourThemeDto[];
  onEdit: (item: SettingsTourThemeDto) => void;
  onDelete: (item: SettingsTourThemeDto) => void;
  onToggleActive: (item: SettingsTourThemeDto, next: boolean) => void;
  onReorder: (itemIds: string[]) => Promise<void>;
  mutating: boolean;
  readOnly?: boolean;
};

export function TourThemeList({
  items,
  onEdit,
  onDelete,
  onToggleActive,
  onReorder,
  mutating,
  readOnly = false,
}: TourThemeListProps) {
  const t = useTranslations("settings");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
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
        {sorted.map((item) => (
          <li key={item.id} className={panelStyles.listItem}>
            <div className={panelStyles.listItemInner}>
              <div className={panelStyles.listItemMain}>
                <div>
                  <strong>{item.name}</strong>
                  <span className={panelStyles.listItemMeta}>{previewDescription(item.description)}</span>
                  <span className={panelStyles.listItemMeta}>
                    {t("tourThemesSortOrderLabel", { n: String(item.sortOrder) })}
                  </span>
                  {!item.isActive ? (
                    <span className={panelStyles.listItemBadge}>— {t("tourThemesInactiveBadge")}</span>
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
          {sorted.map((item) => (
            <SortableTourThemeRow
              key={item.id}
              item={item}
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
