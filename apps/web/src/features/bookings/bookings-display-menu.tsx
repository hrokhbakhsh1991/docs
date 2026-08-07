"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BookingsLayoutSwitch } from "@/features/bookings/bookings-layout-switch";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
  type BookingsCommandCenterQuery,
} from "@/features/bookings/bookings-command-center-types";

type BookingsDisplayMenuProps = {
  readonly query: BookingsCommandCenterQuery;
  readonly onReplaceQuery: (next: BookingsCommandCenterQuery) => void;
};

/** UX-BKG-53 — secondary Display control hosting layout switch. */
export function BookingsDisplayMenu({ query, onReplaceQuery }: BookingsDisplayMenuProps) {
  const t = useTranslations("bookings");
  const layoutActive = query.layout !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.layout;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.displayMenu}
          aria-label={t("displayLabel")}
        >
          {t("displayLabel")}
          {layoutActive ? (
            <span className="ms-1 text-muted-foreground">· {t(`layout.${query.layout}`)}</span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <BookingsLayoutSwitch query={query} onReplaceQuery={onReplaceQuery} embedded />
      </PopoverContent>
    </Popover>
  );
}
