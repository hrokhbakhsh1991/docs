"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  applyBookingsOpsPreset,
  resolveActiveBookingsOpsPreset,
  BOOKINGS_OPS_PRESET_IDS,
} from "@/features/bookings/bookings-ops-path-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  type BookingsCommandCenterQuery,
  type BookingsOpsPresetId,
} from "@/features/bookings/bookings-command-center-types";

type BookingsOpsPresetsBarProps = {
  readonly query: BookingsCommandCenterQuery;
  readonly onReplaceQuery: (next: BookingsCommandCenterQuery) => void;
};

export function BookingsOpsPresetsBar({ query, onReplaceQuery }: BookingsOpsPresetsBarProps) {
  const t = useTranslations("bookings");
  const active = resolveActiveBookingsOpsPreset(query);

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.opsPresets}
      role="group"
      aria-label={t("presetsLabel")}
    >
      <span className="text-xs text-muted-foreground">{t("presetsLabel")}</span>
      {BOOKINGS_OPS_PRESET_IDS.map((preset) => (
        <Button
          key={preset}
          type="button"
          size="sm"
          variant={active === preset ? "default" : "outline"}
          aria-pressed={active === preset}
          aria-label={
            preset === "upcoming"
              ? t("presets.upcomingAria")
              : preset === "workQueue"
                ? t("presets.workQueueAria")
                : preset === "history"
                  ? t("presets.historyAria")
                  : t(`presets.${preset}`)
          }
          onClick={() => onReplaceQuery(applyBookingsOpsPreset(query, preset as BookingsOpsPresetId))}
        >
          {t(`presets.${preset}`)}
        </Button>
      ))}
    </div>
  );
}
