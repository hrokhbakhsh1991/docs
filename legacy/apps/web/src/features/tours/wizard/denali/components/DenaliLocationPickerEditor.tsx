"use client";

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, Input } from "@tour/ui";

import type { GeocodingSearchResult } from "@/lib/geocoding/nominatim";
import type { DenaliLocationDataForm } from "@/features/tours/wizard/schemas/denaliLocationDataSchema";

import { DenaliLocationModalPicker } from "./DenaliLocationModalPicker";
import {
  denaliLocationCoordinateErrorMessage,
  hasDenaliLocationCoordinates,
} from "./denaliLocationFieldUtils";
import { useDebouncedLocationSearch } from "../application";
import { reverseGeocode } from "@/lib/geocoding/geocoding-search";

export type DenaliLocationPickerEditorProps = {
  testIdKey: string;
  modalTitle: string;
  value: DenaliLocationDataForm;
  patch: (_partial: Partial<DenaliLocationDataForm>) => void;
  fieldErrors?:
    | {
        addressText?: { message?: string };
        latitude?: { message?: string };
        longitude?: { message?: string };
      }
    | undefined;
  searchLabel?: string;
  searchHint?: string;
};

type LocationSuggestionListProps = {
  listboxId: string;
  testIdKey: string;
  results: GeocodingSearchResult[];
  isSearching: boolean;
  searchError: string | null;
  emptyMessage: string;
  unavailableMessage: string;
  onSelect: (_item: GeocodingSearchResult) => void;
};

function geocodingSuggestionKey(item: GeocodingSearchResult): string {
  return `${item.latitude.toFixed(4)}:${item.longitude.toFixed(4)}:${item.displayName}`;
}

const LocationSuggestionList = memo(function LocationSuggestionList({
  listboxId,
  testIdKey,
  results,
  isSearching,
  searchError,
  emptyMessage,
  unavailableMessage,
  onSelect,
}: LocationSuggestionListProps) {
  return (
    <ul
      id={listboxId}
      role="listbox"
      data-testid={`denali-location-${testIdKey}-suggestions`}
      style={{
        position: "absolute",
        zIndex: 20,
        top: "100%",
        left: 0,
        right: 0,
        margin: "0.25rem 0 0",
        padding: 0,
        listStyle: "none",
        maxHeight: "12rem",
        overflowY: "auto",
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-slate-200)",
        borderRadius: 8,
        boxShadow: "var(--shadow-location-dropdown)",
      }}
    >
      {results.length === 0 && !isSearching ? (
        <li style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", color: "var(--color-slate-500)" }}>
          {searchError ? unavailableMessage : emptyMessage}
        </li>
      ) : null}
      {results.map((item) => {
        const suggestionKey = geocodingSuggestionKey(item);
        return (
        <li key={suggestionKey} role="option" aria-selected={false}>
          <button
            type="button"
            style={{
              display: "block",
              width: "100%",
              textAlign: "start",
              padding: "0.5rem 0.75rem",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(item)}
            data-testid={`denali-location-${testIdKey}-suggestion-${suggestionKey}`}
          >
            {item.displayName}
          </button>
        </li>
        );
      })}
    </ul>
  );
});

function locationValueKey(value: DenaliLocationDataForm): string {
  return `${value.addressText ?? ""}|${value.latitude ?? ""}|${value.longitude ?? ""}`;
}

function editorPropsEqual(
  prev: DenaliLocationPickerEditorProps,
  next: DenaliLocationPickerEditorProps,
): boolean {
  return (
    prev.testIdKey === next.testIdKey &&
    prev.modalTitle === next.modalTitle &&
    prev.searchLabel === next.searchLabel &&
    prev.searchHint === next.searchHint &&
    prev.patch === next.patch &&
    locationValueKey(prev.value) === locationValueKey(next.value) &&
    prev.fieldErrors?.addressText?.message === next.fieldErrors?.addressText?.message &&
    prev.fieldErrors?.latitude?.message === next.fieldErrors?.latitude?.message &&
    prev.fieldErrors?.longitude?.message === next.fieldErrors?.longitude?.message
  );
}

function DenaliLocationPickerEditorComponent({
  testIdKey,
  modalTitle,
  value,
  patch,
  fieldErrors,
  searchLabel,
  searchHint,
}: DenaliLocationPickerEditorProps) {
  const t = useTranslations("tours.denali");
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);

  const { query, setQuery, results, isSearching, searchError, clearResults } =
    useDebouncedLocationSearch(value.addressText ?? "");

  useEffect(() => {
    setQuery(value.addressText ?? "");
  }, [value.addressText, setQuery]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const applySelection = useCallback(
    (item: GeocodingSearchResult) => {
      patch({
        addressText: item.addressText,
        latitude: item.latitude,
        longitude: item.longitude,
      });
      setQuery(item.addressText);
      clearResults();
      setDropdownOpen(false);
    },
    [clearResults, patch, setQuery],
  );

  const handleSearchChange = useCallback(
    (next: string) => {
      setQuery(next);
      patch({ addressText: next });
      setDropdownOpen(true);
    },
    [patch, setQuery],
  );

  const openMapModal = useCallback(() => setMapModalOpen(true), []);
  const closeMapModal = useCallback(() => setMapModalOpen(false), []);
  const handleMapConfirm = useCallback(
    async (coords: { latitude: number; longitude: number }) => {
      // Two-way sync: Fetch address from map coordinates
      const address = await reverseGeocode(coords.latitude, coords.longitude);
      if (address) {
        patch({ ...coords, addressText: address });
        setQuery(address);
      } else {
        patch(coords);
      }
    },
    [patch, setQuery],
  );

  const coordError = denaliLocationCoordinateErrorMessage(fieldErrors);
  const resolvedAddress = value.addressText?.trim();
  const label = searchLabel ?? t("basic.locationZones.searchLabel");
  const hint = searchHint ?? t("basic.locationZones.searchHint");

  return (
    <div ref={rootRef} style={{ display: "grid", gap: "0.5rem" }}>
      <FormField label={label} error={fieldErrors?.addressText?.message} description={hint}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 12rem", minWidth: 0 }}>
            <Input
              type="search"
              role="combobox"
              aria-expanded={dropdownOpen && results.length > 0}
              aria-controls={listboxId}
              autoComplete="off"
              value={query}
              placeholder={t("basic.locationZones.searchPlaceholder")}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              data-testid={`denali-location-${testIdKey}-search`}
            />
            {isSearching ? (
              <span
                style={{
                  position: "absolute",
                  left: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "0.75rem",
                  color: "var(--color-slate-500)",
                }}
              >
                …
              </span>
            ) : null}
            {dropdownOpen && query.trim().length >= 2 ? (
              <LocationSuggestionList
                listboxId={listboxId}
                testIdKey={testIdKey}
                results={results}
                isSearching={isSearching}
                searchError={searchError}
                emptyMessage={t("basic.locationZones.searchNoResults")}
                unavailableMessage={t("basic.locationZones.searchUnavailable")}
                onSelect={applySelection}
              />
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={openMapModal}
            data-testid={`denali-location-${testIdKey}-map-open`}
          >
            {t("basic.locationZones.mapPickerButton")}
          </Button>
        </div>
      </FormField>

      {resolvedAddress ? (
        <Badge variant="neutral" data-testid={`denali-location-${testIdKey}-address-badge`}>
          {t("basic.locationZones.selectedAddress", { address: resolvedAddress })}
        </Badge>
      ) : null}

      {hasDenaliLocationCoordinates(value) ? (
        <span
          style={{ fontSize: "0.75rem", color: "var(--color-slate-500)" }}
          data-testid={`denali-location-${testIdKey}-coords-badge`}
        >
          {t("basic.locationZones.coordinatesSet", {
            lat: value.latitude!.toFixed(5),
            lng: value.longitude!.toFixed(5),
          })}
        </span>
      ) : (
        <span style={{ fontSize: "0.75rem", color: "var(--color-slate-500)" }}>
          {t("basic.locationZones.mapPickerHint")}
        </span>
      )}

      {coordError ? (
        <p
          role="alert"
          data-testid={`denali-location-${testIdKey}-coord-error`}
          style={{
            margin: 0,
            fontSize: "0.8rem",
            color: "var(--color-danger-800)",
          }}
        >
          {coordError}
        </p>
      ) : null}

      <DenaliLocationModalPicker
        open={mapModalOpen}
        onClose={closeMapModal}
        title={modalTitle}
        testIdKey={testIdKey}
        value={value}
        onConfirm={handleMapConfirm}
      />
    </div>
  );
}

export const DenaliLocationPickerEditor = memo(
  DenaliLocationPickerEditorComponent,
  editorPropsEqual,
);
