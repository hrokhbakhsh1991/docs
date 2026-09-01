"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { GeocodingSearchResult } from "../adapters/geocoding";
import { Button } from "../adapters/platform-primitives";
import {
  hasLocationCoordinates,
  resolveLocationConfirmPatch,
  type DenaliLocationAddressValue,
} from "../logic/denali-location-modal-logic";
import {
  DenaliLocationMapModal,
  type DenaliLocationMapOpenIntent,
} from "./denali-location-map-modal";

export type { DenaliLocationAddressValue };

type DenaliLocationAddressPickerProps = {
  readonly testIdKey: string;
  readonly value: DenaliLocationAddressValue;
  readonly onChange: (_patch: Partial<DenaliLocationAddressValue>) => void;
  /** Human-readable location context for the modal title (zone name, station name, etc.). */
  readonly locationContextName: string;
  /** Optional place metadata (title). Must not be mixed into persisted location value. */
  readonly onPlaceSelect?: (place: GeocodingSearchResult) => void;
};

export function DenaliLocationAddressPicker({
  testIdKey,
  value,
  onChange,
  locationContextName,
  onPlaceSelect,
}: DenaliLocationAddressPickerProps) {
  const t = useTranslations("denali.composites.location");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const removeTriggerRef = useRef<HTMLButtonElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [openIntent, setOpenIntent] = useState<DenaliLocationMapOpenIntent>("edit");

  const resolvedAddress = value.address?.trim() ?? "";
  const hasCoords = hasLocationCoordinates(value);
  const hasLocationSelection = resolvedAddress.length > 0 || hasCoords;

  const openModal = useCallback((intent: DenaliLocationMapOpenIntent = "edit") => {
    setOpenIntent(intent);
    setModalOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    setModalOpen(false);
    setOpenIntent("edit");
  }, []);

  const handleConfirm = useCallback(
    (next: DenaliLocationAddressValue) => {
      onChange(resolveLocationConfirmPatch(next));
      setModalOpen(false);
      setOpenIntent("edit");
    },
    [onChange]
  );

  return (
    <div className="denali-wizard-composite__location-picker">
      {hasLocationSelection ? (
        <p
          className="denali-wizard-composite__location-selected"
          data-testid={`denali-location-${testIdKey}-address-badge`}
        >
          {resolvedAddress.length > 0
            ? t("selectedAddress", { address: resolvedAddress })
            : t("inlineCoordinatesOnly")}
        </p>
      ) : (
        <p className="denali-wizard-composite__location-coords">{t("inlineEmptyHint")}</p>
      )}

      <div className="denali-wizard-composite__location-map-trigger">
        <Button
          ref={triggerRef}
          type="button"
          variant="secondary"
          onClick={() => openModal("edit")}
          data-testid={`denali-location-${testIdKey}-open-map`}
        >
          {hasLocationSelection ? t("mapModalChangeAction") : t("mapModalOpenAction")}
        </Button>
        {hasLocationSelection ? (
          <Button
            ref={removeTriggerRef}
            type="button"
            variant="secondary"
            onClick={() => openModal("clear")}
            data-testid={`denali-location-${testIdKey}-remove-map`}
          >
            {t("mapModalRemoveAction")}
          </Button>
        ) : null}
      </div>

      {modalOpen ? (
        <DenaliLocationMapModal
          open={modalOpen}
          openIntent={openIntent}
          initialValue={value}
          locationContextName={locationContextName}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          testIdKey={testIdKey}
          onPlaceSelect={onPlaceSelect}
          returnFocusRef={openIntent === "clear" ? removeTriggerRef : triggerRef}
        />
      ) : null}
    </div>
  );
}
