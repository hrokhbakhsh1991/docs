"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useLocale, useTranslations } from "next-intl";

import type { GeocodingSearchResult } from "../adapters/geocoding";
import { toLocalizedDigits, type AppLocale } from "../adapters/i18n-format";
import { Button, Input } from "../adapters/platform-primitives";
import { fetchReverseGeocodeAddress } from "../adapters/reverse-geocode-client";
import { useDebouncedLocationSearch } from "../hooks/use-debounced-location-search";
import {
  applyGeolocationPositionIntent,
  applyGeolocationReverseIntent,
  applyReverseGeocodeToMapIntent,
  beginGeolocationIntent,
  beginManualAddressSearchIntent,
  beginMapLocationIntent,
  beginSearchSelectionIntent,
  cloneLocationAddressValue,
  createLocationModalAsyncSession,
  hasLocationCoordinates,
  isLocationModalConfirmDisabled,
  resetLocationModalAsyncSession,
  toMapCoordinates,
  type DenaliLocationAddressValue,
  type LocationModalAsyncSession,
} from "../logic/denali-location-modal-logic";
import { DenaliLocationPickerMap } from "./map/denali-location-picker-map";

function geocodingSuggestionKey(item: GeocodingSearchResult): string {
  return `${item.latitude.toFixed(4)}:${item.longitude.toFixed(4)}:${item.displayName}`;
}

function formatCoordinateLabel(value: number, locale: AppLocale): string {
  return toLocalizedDigits(value.toFixed(5), locale);
}

function useMobileSheetLayout(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}

export type DenaliLocationMapOpenIntent = "edit" | "clear";

export type DenaliLocationMapModalProps = {
  readonly open: boolean;
  readonly openIntent?: DenaliLocationMapOpenIntent;
  readonly initialValue: DenaliLocationAddressValue;
  readonly locationContextName: string;
  readonly onConfirm: (value: DenaliLocationAddressValue) => void;
  readonly onCancel: () => void;
  readonly testIdKey: string;
  readonly onPlaceSelect?: (place: GeocodingSearchResult) => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
};

export function DenaliLocationMapModal({
  open,
  openIntent = "edit",
  initialValue,
  locationContextName,
  onConfirm,
  onCancel,
  testIdKey,
  onPlaceSelect,
  returnFocusRef,
}: DenaliLocationMapModalProps) {
  const t = useTranslations("denali.composites.location");
  const locale = useLocale() as AppLocale;
  const titleId = useId();
  const descriptionId = useId();
  const listboxId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRootRef = useRef<HTMLDivElement>(null);
  const asyncSessionRef = useRef<LocationModalAsyncSession>(createLocationModalAsyncSession());
  const confirmedRef = useRef(false);
  const pendingPlaceSelectRef = useRef<GeocodingSearchResult | null>(null);
  const [modalDraft, setModalDraft] = useState<DenaliLocationAddressValue>(() =>
    cloneLocationAddressValue(initialValue)
  );
  const [reversePending, setReversePending] = useState(false);
  const [geolocationPending, setGeolocationPending] = useState(false);
  const [geolocationError, setGeolocationError] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mapResizeSignal, setMapResizeSignal] = useState(0);
  const isMobileSheet = useMobileSheetLayout();

  const { query, setQuery, results, isSearching, searchError, clearResults } =
    useDebouncedLocationSearch(initialValue.address ?? "");

  useEffect(() => {
    if (!open) {
      return;
    }
    if (openIntent === "clear") {
      setModalDraft({});
      setQuery("");
    } else {
      const cloned = cloneLocationAddressValue(initialValue);
      setModalDraft(cloned);
      setQuery(cloned.address ?? "");
    }
    setReversePending(false);
    setGeolocationPending(false);
    setGeolocationError(false);
    setDropdownOpen(false);
    clearResults();
    resetLocationModalAsyncSession(asyncSessionRef.current);
    confirmedRef.current = false;
    pendingPlaceSelectRef.current = null;
  }, [clearResults, initialValue, open, openIntent, setQuery]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog == null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      return;
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    let frame = 0;
    const bumpResize = () => setMapResizeSignal((current) => current + 1);
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(bumpResize);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (event: MouseEvent) => {
      if (!searchRootRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handleDialogClose = useCallback(() => {
    if (!confirmedRef.current) {
      onCancel();
    }
    confirmedRef.current = false;
    returnFocusRef?.current?.focus();
  }, [onCancel, returnFocusRef]);

  const handleConfirm = useCallback(() => {
    confirmedRef.current = true;
    dialogRef.current?.close();
    const place = pendingPlaceSelectRef.current;
    if (place != null) {
      onPlaceSelect?.(place);
    }
    onConfirm(cloneLocationAddressValue(modalDraft));
  }, [modalDraft, onConfirm, onPlaceSelect]);

  const requestClose = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const clearGeolocationError = useCallback(() => {
    setGeolocationError(false);
  }, []);

  const applySearchSelection = useCallback(
    (item: GeocodingSearchResult) => {
      const next = beginSearchSelectionIntent(asyncSessionRef.current, item);
      setModalDraft(next);
      setQuery(item.addressText);
      pendingPlaceSelectRef.current = item;
      clearResults();
      setDropdownOpen(false);
      setReversePending(false);
      setGeolocationPending(false);
      clearGeolocationError();
    },
    [clearGeolocationError, clearResults, setQuery]
  );

  const handleSearchChange = useCallback(
    (next: string) => {
      setQuery(next);
      setModalDraft(beginManualAddressSearchIntent(asyncSessionRef.current, next));
      setDropdownOpen(true);
      setReversePending(false);
      setGeolocationPending(false);
      clearGeolocationError();
    },
    [clearGeolocationError, setQuery]
  );

  const handleMapChange = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      const intent = beginMapLocationIntent(asyncSessionRef.current, coords);
      setGeolocationPending(false);
      setModalDraft(intent.pendingDraft);
      setReversePending(true);
      clearGeolocationError();

      void (async () => {
        const address = await fetchReverseGeocodeAddress(coords.latitude, coords.longitude);
        const result = applyReverseGeocodeToMapIntent(
          asyncSessionRef.current,
          intent.reverseRequestId,
          coords,
          address
        );
        if (result.stale) {
          return;
        }
        setReversePending(false);
        setModalDraft(result.draft);
        if (result.draft.address != null) {
          setQuery(result.draft.address);
          return;
        }
        setQuery(
          t("coordinatesSet", {
            lat: formatCoordinateLabel(coords.latitude, locale),
            lng: formatCoordinateLabel(coords.longitude, locale),
          })
        );
      })();
    },
    [clearGeolocationError, locale, setQuery, t]
  );

  const useCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setGeolocationError(true);
      return;
    }
    const geolocationRequestId = beginGeolocationIntent(asyncSessionRef.current);
    setGeolocationPending(true);
    setGeolocationError(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const coords = { latitude, longitude };
        const positionIntent = applyGeolocationPositionIntent(
          asyncSessionRef.current,
          geolocationRequestId,
          coords
        );
        if (positionIntent.stale) {
          return;
        }
        setModalDraft(positionIntent.pendingDraft);
        setReversePending(true);
        clearGeolocationError();
        void (async () => {
          const address = await fetchReverseGeocodeAddress(latitude, longitude);
          const result = applyGeolocationReverseIntent(
            asyncSessionRef.current,
            geolocationRequestId,
            positionIntent.reverseRequestId,
            coords,
            address
          );
          if (result.stale) {
            return;
          }
          setReversePending(false);
          setGeolocationPending(false);
          setModalDraft(result.draft);
          if (result.draft.address != null) {
            setQuery(result.draft.address);
            return;
          }
          setQuery(
            t("coordinatesSet", {
              lat: formatCoordinateLabel(latitude, locale),
              lng: formatCoordinateLabel(longitude, locale),
            })
          );
        })();
      },
      () => {
        if (geolocationRequestId === asyncSessionRef.current.geolocationRequestId) {
          setGeolocationPending(false);
          setGeolocationError(true);
        }
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, [clearGeolocationError, locale, setQuery, t]);

  const confirmDisabled = isLocationModalConfirmDisabled(reversePending, geolocationPending);
  const resolvedAddress = modalDraft.address?.trim();
  const mapValue = toMapCoordinates(modalDraft);

  return (
    <dialog
      ref={dialogRef}
      className={
        isMobileSheet
          ? "denali-location-map-modal denali-location-map-modal--sheet"
          : "denali-location-map-modal denali-location-map-modal--dialog"
      }
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid={`denali-location-${testIdKey}-map-modal`}
      onClose={handleDialogClose}
      onCancel={(event) => {
        event.preventDefault();
        handleDialogClose();
      }}
    >
      <div className="denali-location-map-modal__panel">
        <header className="denali-location-map-modal__header">
          <h2 id={titleId} className="denali-location-map-modal__title">
            {t("mapModalTitleForLocation", { name: locationContextName })}
          </h2>
          <p id={descriptionId} className="denali-location-map-modal__description">
            {t("mapModalDescription")}
          </p>
        </header>

        <div className="denali-location-map-modal__scroll">
          <div ref={searchRootRef} className="denali-location-map-modal__search">
            <label className="denali-wizard-composite__field">
              <span>{t("searchLabel")}</span>
              <span className="denali-wizard-composite__status">{t("searchHint")}</span>
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
                  data-testid={`denali-location-${testIdKey}-modal-search`}
                />
                {isSearching || reversePending || geolocationPending ? (
                  <span
                    className="denali-wizard-composite__location-search-loading"
                    aria-hidden
                  >
                    …
                  </span>
                ) : null}
                {dropdownOpen && query.trim().length >= 2 ? (
                  <ul
                    id={listboxId}
                    role="listbox"
                    className="denali-wizard-composite__location-suggestions"
                    data-testid={`denali-location-${testIdKey}-modal-suggestions`}
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
                            onClick={() => applySearchSelection(item)}
                            data-testid={`denali-location-${testIdKey}-modal-suggestion-${suggestionKey}`}
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
          </div>

          <div
            className="denali-location-map-modal__map-wrap"
            data-location-map-resize-signal={mapResizeSignal}
          >
            <DenaliLocationPickerMap
              value={mapValue}
              onChange={handleMapChange}
              layout="fill"
              scrollWheelZoom={!isMobileSheet}
              resizeSignal={mapResizeSignal}
              data-testid={`denali-location-${testIdKey}-modal-map`}
            />
          </div>

          <p
            className="denali-location-map-modal__map-hint denali-wizard-composite__status"
            data-testid={`denali-location-${testIdKey}-modal-map-hint`}
          >
            {t("mapInteractionHint")}
          </p>

          <div
            className="denali-location-map-modal__summary"
            aria-busy={reversePending || geolocationPending ? true : undefined}
          >
            {resolvedAddress ? (
              <p
                className="denali-wizard-composite__location-selected"
                data-testid={`denali-location-${testIdKey}-modal-address`}
              >
                {t("selectedAddress", { address: resolvedAddress })}
              </p>
            ) : (
              <p className="denali-wizard-composite__location-coords">{t("pickFromMapHint")}</p>
            )}
            {hasLocationCoordinates(modalDraft) ? (
              <p
                className="denali-wizard-composite__location-coords denali-location-map-modal__coords"
                data-testid={`denali-location-${testIdKey}-modal-coords`}
              >
                {t("coordinatesSet", {
                  lat: formatCoordinateLabel(modalDraft.latitude!, locale),
                  lng: formatCoordinateLabel(modalDraft.longitude!, locale),
                })}
              </p>
            ) : null}
          </div>

          {geolocationError ? (
            <p
              className="denali-wizard-composite__error denali-location-map-modal__geolocation-error"
              role="alert"
              data-testid={`denali-location-${testIdKey}-modal-geolocation-error`}
            >
              {t("geolocationError")}
            </p>
          ) : null}
        </div>

        <footer className="denali-location-map-modal__footer">
          <Button type="button" variant="secondary" onClick={useCurrentPosition}>
            {t("useCurrentLocation")}
          </Button>
          <div className="denali-location-map-modal__footer-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={requestClose}
              data-testid={`denali-location-${testIdKey}-modal-cancel`}
            >
              {t("mapModalCancel")}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={confirmDisabled}
              data-testid={`denali-location-${testIdKey}-modal-confirm`}
            >
              {t("mapModalConfirm")}
            </Button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
