"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";

type FinanceRegistrationPickerProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (registrationId: string) => void;
  readonly disabled?: boolean;
};

type PickerOption = {
  readonly id: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
};

function parseBookingPickerItems(raw: unknown): readonly PickerOption[] {
  if (raw === null || typeof raw !== "object") {
    return [];
  }
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .filter((entry): entry is BookingListItem => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      id: String(entry.id ?? ""),
      tourTitle: String(entry.tourTitle ?? ""),
      guestLabel: String(entry.guestLabel ?? ""),
    }))
    .filter((entry) => entry.id.length > 0);
}

/**
 * Phase C — search bookings via existing BFF (no new finance search endpoint).
 * R-ARCH-09: same-session `/api/bookings?view=ops`.
 */
export function FinanceRegistrationPicker({
  id: idProp,
  value,
  onChange,
  disabled = false,
}: FinanceRegistrationPickerProps) {
  const t = useTranslations("finance.picker");
  const tCommon = useTranslations("finance.common");
  const autoId = useId();
  const fieldId = idProp ?? autoId;
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<readonly PickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (value.trim().length === 0) {
      setSelectedLabel(null);
    }
  }, [value]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setOptions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ view: "ops", q });
      void fetch(`/api/bookings?${params.toString()}`, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`BOOKINGS_PICKER_HTTP_${response.status}`);
          }
          return parseBookingPickerItems(await response.json());
        })
        .then((items) => {
          if (!cancelled) {
            setOptions(items.slice(0, 20));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setOptions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const selectOption = (option: PickerOption) => {
    onChange(option.id);
    setSelectedLabel(`${option.tourTitle} — ${option.guestLabel}`);
    setQuery("");
    setOptions([]);
  };

  return (
    <div className="space-y-2" data-testid="finance-registration-picker">
      <Label htmlFor={fieldId}>{t("label")}</Label>
      {selectedLabel !== null && value.trim().length > 0 ? (
        <p className="text-sm text-foreground" data-testid="finance-registration-picker-selected">
          {selectedLabel}
          <span className="ms-2 font-mono text-xs text-muted-foreground">{value}</span>
        </p>
      ) : null}
      <Input
        id={fieldId}
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("searchPlaceholder")}
        autoComplete="off"
      />
      {loading ? <p className="text-xs text-muted-foreground">{tCommon("loading")}</p> : null}
      {options.length > 0 ? (
        <ul
          className="max-h-48 overflow-y-auto rounded-md border bg-background"
          data-testid="finance-registration-picker-options"
        >
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => selectOption(option)}
              >
                <span className="font-medium">{option.tourTitle}</span>
                <span className="text-muted-foreground">{option.guestLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">{t("advancedUuid")}</summary>
        <Input
          className="mt-2 font-mono text-xs"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
            setSelectedLabel(null);
          }}
          placeholder={t("uuidPlaceholder")}
          autoComplete="off"
          data-testid="finance-registration-picker-uuid"
        />
      </details>
    </div>
  );
}
