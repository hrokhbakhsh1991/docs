"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { GeocodingSearchResult } from "../adapters/geocoding";
import { Input } from "../adapters/platform-primitives";
import { fetchReverseGeocodeAddress } from "../adapters/reverse-geocode-client";
import { useDebouncedLocationSearch } from "../hooks/use-debounced-location-search";
import {
  DenaliLocationPickerMap,
  type DenaliMapCoordinates,
} from "./map/denali-location-picker-map";

export type DenaliLocationAddressValue = {
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
};

type DenaliLocationAddressPickerProps = {
  readonly testIdKey: string;
  readonly value: DenaliLocationAddressValue;
  readonly onChange: (_patch: Partial<DenaliLocationAddressValue>) => void;
  readonly label?: string;
  readonly hint?: string;
  /**
   * When false, skip mounting the map widget (INV-DENALI-WIZ-019).
   * Search / address fields still render so collapsed panels stay editable after open.
   */
  readonly mapMounted?: boolean;
};

function geocodingSuggestionKey(item: GeocodingSearchResult): string {
  return `${item.latitude.toFixed(4)}:${item.longitude.toFixed(4)}:${item.displayName}`;
}

function hasCoordinates(value: DenaliLocationAddressValue): boolean {
  return (
    value.latitude !== undefined &&
    value.longitude !== undefined &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  );
}

function toMapCoordinates(value: DenaliLocationAddressValue): DenaliMapCoordinates {
  if (!hasCoordinates(value)) {
    return null;
  }
  return { latitude: value.latitude!, longitude: value.longitude! };
}

export function DenaliLocationAddressPicker({
  testIdKey,
  value,
  onChange,
  label,
  hint,
  mapMounted = true,
}: DenaliLocationAddressPickerProps) {
  const t = useTranslations("denali.composites.location");
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const reverseRequestRef = useRef(0);
  const [mapValue, setMapValue] = useState<DenaliMapCoordinates>(() => toMapCoordinates(value));
  const [reversePending, setReversePending] = useState(false);

  const { query, setQuery, results, isSearching, searchError, clearResults } =
    useDebouncedLocationSearch(value.address ?? "");

  useEffect(() => {
    setMapValue(toMapCoordinates(value));
  }, [value.latitude, value.longitude]);

  useEffect(() => {
    if (!reversePending) {
      setQuery(value.address ?? "");
    }
  }, [value.address, reversePending, setQuery]);

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
      const next = {
        address: item.addressText,
        latitude: item.latitude,
        longitude: item.longitude,
      };
      setMapValue({ latitude: item.latitude, longitude: item.longitude });
      onChange(next);
      setQuery(item.addressText);
      clearResults();
      setDropdownOpen(false);
      setReversePending(false);
    },
    [clearResults, onChange, setQuery]
  );

  const handleSearchChange = useCallback(
    (next: string) => {
      setQuery(next);
      onChange({ address: next });
      setDropdownOpen(true);
    },
    [onChange, setQuery]
  );

  const handleMapChange = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      const requestId = ++reverseRequestRef.current;
      setMapValue(coords);
      setReversePending(true);
      onChange({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      void (async () => {
        const address = await fetchReverseGeocodeAddress(coords.latitude, coords.longitude);
        if (requestId !== reverseRequestRef.current) {
          return;
        }
        setReversePending(false);
        if (address !== null) {
          onChange({
            address,
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          setQuery(address);
          return;
        }
        const fallback = t("coordinatesSet", {
          lat: coords.latitude.toFixed(5),
          lng: coords.longitude.toFixed(5),
        });
        setQuery(fallback);
      })();
    },
    [onChange, setQuery, t]
  );

  const resolvedLabel = label ?? t("searchLabel");
  const resolvedHint = hint ?? t("searchHint");
  const resolvedAddress = value.address?.trim();

  return (
    <div ref={rootRef} className="denali-wizard-composite__location-picker">
      <label className="denali-wizard-composite__field">
        <span>{resolvedLabel}</span>
        {resolvedHint ? (
          <span className="denali-wizard-composite__status">{resolvedHint}</span>
        ) : null}
        <div className="denali-wizard-composite__location-search-wrap">
          <Input
            type="search"
            role="combobox"
            aria-expanded={dropdownOpen && results.length > 0}
            aria-controls={listboxId}
            autoComplete="off"
            value={query}
            placeholder={t("searchPlaceholder")}
            onChange={(event) => handleSearchChange(event.target.value)}
            onFocus={() => setDropdownOpen(true)}
            data-testid={`denali-location-${testIdKey}-search`}
          />
          {isSearching || reversePending ? (
            <span className="denali-wizard-composite__location-search-loading" aria-hidden>
              …
            </span>
          ) : null}
          {dropdownOpen && query.trim().length >= 2 ? (
            <ul
              id={listboxId}
              role="listbox"
              className="denali-wizard-composite__location-suggestions"
              data-testid={`denali-location-${testIdKey}-suggestions`}
            >
              {results.length === 0 && !isSearching ? (
                <li className="denali-wizard-composite__location-suggestion-empty">
                  {searchError ? t("searchUnavailable") : t("searchNoResults")}
                </li>
              ) : null}
              {results.map((item) => {
                const suggestionKey = geocodingSuggestionKey(item);
                return (
                  <li key={suggestionKey} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className="denali-wizard-composite__location-suggestion"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applySelection(item)}
                      data-testid={`denali-location-${testIdKey}-suggestion-${suggestionKey}`}
                    >
                      {item.displayName}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </label>

      {resolvedAddress ? (
        <p
          className="denali-wizard-composite__location-selected"
          data-testid={`denali-location-${testIdKey}-address-badge`}
        >
          {t("selectedAddress", { address: resolvedAddress })}
        </p>
      ) : null}

      {hasCoordinates(value) ? (
        <p
          className="denali-wizard-composite__location-coords"
          data-testid={`denali-location-${testIdKey}-coords-badge`}
        >
          {t("coordinatesSet", {
            lat: value.latitude!.toFixed(5),
            lng: value.longitude!.toFixed(5),
          })}
        </p>
      ) : (
        <p className="denali-wizard-composite__location-coords">{t("pickFromMapHint")}</p>
      )}

      <div className="denali-wizard-composite__map-wrap">
        {mapMounted ? (
          <DenaliLocationPickerMap
            value={mapValue}
            onChange={handleMapChange}
            height={220}
            data-testid={`denali-location-${testIdKey}-map`}
          />
        ) : (
          <p
            className="denali-wizard-composite__location-map-hint"
            data-testid={`denali-location-${testIdKey}-map-deferred`}
          >
            {t("mapDeferredHint")}
          </p>
        )}
        {mapMounted ? (
          <p className="denali-wizard-composite__location-map-hint">{t("mapInteractionHint")}</p>
        ) : null}
      </div>
    </div>
  );
}
