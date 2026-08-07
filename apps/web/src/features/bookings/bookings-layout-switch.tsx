"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { applyBookingsCommandCenterLayout } from "@/features/bookings/bookings-ops-path-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  type BookingsCommandCenterLayout,
  type BookingsCommandCenterQuery,
} from "@/features/bookings/bookings-command-center-types";

const LAYOUTS: readonly BookingsCommandCenterLayout[] = ["inbox", "timeline", "board"];
// Labels: List · By departure · By tour (`bookings.layout.*` — UX-BKG-44 / UX-BKG-53).

type BookingsLayoutSwitchProps = {
  readonly query: BookingsCommandCenterQuery;
  readonly onReplaceQuery: (next: BookingsCommandCenterQuery) => void;
  /** UX-BKG-53 — inside Display popover; omit peer chrome label. */
  readonly embedded?: boolean;
};

export function BookingsLayoutSwitch({
  query,
  onReplaceQuery,
  embedded = false,
}: BookingsLayoutSwitchProps) {
  const t = useTranslations("bookings");
  const groupLabel = embedded ? t("displayLabel") : t("layoutLabel");

  return (
    <div className="space-y-1">
      <div
        className="flex flex-wrap items-center gap-1"
        data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.layoutSwitch}
        role="group"
        aria-label={groupLabel}
      >
        {embedded ? (
          <span className="me-1 text-xs font-medium text-foreground">{t("displayLabel")}</span>
        ) : (
          <span className="me-1 text-xs text-muted-foreground">{t("layoutLabel")}</span>
        )}
        {LAYOUTS.map((layout) => (
          <Button
            key={layout}
            type="button"
            size="sm"
            variant={query.layout === layout ? "default" : "outline"}
            aria-pressed={query.layout === layout}
            title={layout === "timeline" ? t("layout.timelineHint") : undefined}
            onClick={() => onReplaceQuery(applyBookingsCommandCenterLayout(query, layout))}
          >
            {t(`layout.${layout}`)}
          </Button>
        ))}
      </div>
      {query.layout === "timeline" ? (
        <p
          className={
            embedded
              ? "text-xs text-muted-foreground"
              : "hidden text-xs text-muted-foreground sm:block"
          }
        >
          {t("layout.timelineHint")}
        </p>
      ) : null}
    </div>
  );
}
