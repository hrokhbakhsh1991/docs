"use client";

import { TOUR_TYPES } from "@repo/types";
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
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { useCallback, useMemo } from "react";

import type { SettingsTourPresetDto } from "@/lib/settings-tour-presets.client";

import { Button, Checkbox } from "@tour/ui";

import panelStyles from "../locations/locations-settings-panel.module.css";

const DESCRIPTION_PREVIEW_MAX = 120;

function previewDescription(text: string | null | undefined): string {
  if (!text?.trim()) {
    return "—";
  }
  const s = text.trim();
  return s.length > DESCRIPTION_PREVIEW_MAX ? `${s.slice(0, DESCRIPTION_PREVIEW_MAX)}…` : s;
}

type SortableTourPresetRowProps = {
  item: SettingsTourPresetDto;
  themeNameById: Map<string, string>;
  onEdit: (item: SettingsTourPresetDto) => void;
  showDuplicate: boolean;
  onDuplicate: (item: SettingsTourPresetDto) => void;
  onDelete: (item: SettingsTourPresetDto) => void;
  onToggleActive: (item: SettingsTourPresetDto, next: boolean) => void;
  mutating: boolean;
};

function SortableTourPresetRow({
  item,
  themeNameById,
  onEdit,
  showDuplicate,
  onDuplicate,
  onDelete,
  onToggleActive,
  mutating,
}: SortableTourPresetRowProps) {
  const t = useTranslations("settings");
  const router = useRouter();
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

  const matchParts: string[] = [];
  const ovRaw = item.defaults?.overview;
  let presetTourType: string | null = null;
  let presetThemeId: string | null = null;
  if (ovRaw != null && typeof ovRaw === "object" && !Array.isArray(ovRaw)) {
    const o = ovRaw as Record<string, unknown>;
    if (typeof o.tourType === "string" && o.tourType.trim() !== "") {
      presetTourType = o.tourType.trim();
    }
    if (typeof o.mainTourThemeId === "string" && o.mainTourThemeId.trim() !== "") {
      presetThemeId = o.mainTourThemeId.trim();
    }
  }
  if (presetTourType && (TOUR_TYPES as readonly string[]).includes(presetTourType)) {
    matchParts.push(
      t("tourPresetsMetaMatchPartType", {
        label: t(`tourPresetsTourType_${presetTourType}` as never),
      }),
    );
  } else if (presetTourType) {
    matchParts.push(t("tourPresetsMetaDefaultsTourTypeRaw", { value: presetTourType }));
  }
  if (presetThemeId) {
    const tn = themeNameById.get(presetThemeId);
    matchParts.push(
      t("tourPresetsMetaMatchPartTheme", {
        name: tn ?? presetThemeId.slice(0, 8),
      }),
    );
  }
  const matchLine =
    matchParts.length > 0 ? t("tourPresetsMetaMatch", { parts: matchParts.join(" · ") }) : t("tourPresetsMatchNone");

  const rootKeys = Object.keys(item.defaults ?? {});
  const keysLine =
    rootKeys.length > 0 ? t("tourPresetsMetaDefaultsKeys", { keys: rootKeys.slice(0, 8).join(", ") }) : "—";

  return (
    <li ref={setNodeRef} style={style} className={panelStyles.listItem}>
      <div className={panelStyles.listItemInner}>
        <button
          type="button"
          className={panelStyles.dragHandle}
          aria-label={t("tourPresetsDragHandleLabel")}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className={panelStyles.listItemMain}>
          <div>
            <strong>{item.name}</strong>
            <span className={panelStyles.listItemMeta}>{previewDescription(item.description)}</span>
            <span className={panelStyles.listItemMeta}>{matchLine}</span>
            <span className={panelStyles.listItemMeta}>
              {t("tourPresetsMetaFormProfile", { profile: item.formProfile ?? "general" })}
            </span>
            <span className={panelStyles.listItemMeta}>{keysLine}</span>
            <span className={panelStyles.listItemMeta}>{t("tourPresetsSortOrderLabel", { n: String(item.sortOrder) })}</span>
            {!item.isActive ? <span className={panelStyles.listItemBadge}>— {t("tourPresetsInactiveBadge")}</span> : null}
          </div>
          <div className={panelStyles.listItemActions}>
            <label className={panelStyles.listItemMeta} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Checkbox
                bare
                checked={item.isActive}
                disabled={mutating}
                onChange={(e) => onToggleActive(item, e.currentTarget.checked)}
                aria-label={t("tourPresetsFieldActive")}
              />
              <span>{t("tourPresetsFieldActive")}</span>
            </label>
            {item.formProfile === "denali_pilot" && item.isActive ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={mutating}
                data-testid={`tour-preset-create-tour-${item.id}`}
                onClick={() => router.push(`/tours/new?presetId=${encodeURIComponent(item.id)}`)}
              >
                {t("tourPresetsCreateTourFromTemplate")}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(item)} disabled={mutating}>
              {t("tourPresetsEdit")}
            </Button>
            {showDuplicate ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onDuplicate(item)} disabled={mutating}>
                {t("tourPresetsCopy")}
              </Button>
            ) : null}
            <Button type="button" variant="danger" size="sm" onClick={() => void onDelete(item)} disabled={mutating}>
              {t("tourPresetsDelete")}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

export type TourPresetListProps = {
  items: SettingsTourPresetDto[];
  themeNameById: Map<string, string>;
  onEdit: (item: SettingsTourPresetDto) => void;
  showDuplicate?: boolean;
  onDuplicate: (item: SettingsTourPresetDto) => void;
  onDelete: (item: SettingsTourPresetDto) => void;
  onToggleActive: (item: SettingsTourPresetDto, next: boolean) => void;
  onReorder: (itemIds: string[]) => Promise<void>;
  mutating: boolean;
  readOnly?: boolean;
};

export function TourPresetList({
  items,
  themeNameById,
  onEdit,
  showDuplicate = false,
  onDuplicate,
  onDelete,
  onToggleActive,
  onReorder,
  mutating,
  readOnly = false,
}: TourPresetListProps) {
  const t = useTranslations("settings");
  const router = useRouter();
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
                  {!item.isActive ? (
                    <span className={panelStyles.listItemBadge}>— {t("tourPresetsInactiveBadge")}</span>
                  ) : null}
                </div>
                {item.formProfile === "denali_pilot" && item.isActive ? (
                  <div className={panelStyles.listItemActions}>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      data-testid={`tour-preset-create-tour-${item.id}`}
                      onClick={() => router.push(`/tours/new?presetId=${encodeURIComponent(item.id)}`)}
                    >
                      {t("tourPresetsCreateTourFromTemplate")}
                    </Button>
                  </div>
                ) : null}
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
            <SortableTourPresetRow
              key={item.id}
              item={item}
              themeNameById={themeNameById}
              onEdit={onEdit}
              showDuplicate={showDuplicate}
              onDuplicate={onDuplicate}
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
