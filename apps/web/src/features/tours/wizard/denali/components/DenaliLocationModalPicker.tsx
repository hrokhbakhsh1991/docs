"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, Modal } from "@tour/ui";

import {
  DenaliLocationPickerMap,
  type DenaliMapCoordinates,
} from "@/components/ui/map/DenaliLocationPickerMap";
import type { DenaliLocationDataForm } from "@/features/tours/wizard/schemas/denaliLocationDataSchema";
import { useDenaliWizardSync } from "../DenaliWizardSyncContext";

function toMapCoordinates(value: DenaliLocationDataForm): DenaliMapCoordinates {
  if (
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude)
  ) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  return null;
}

export type DenaliLocationModalPickerProps = {
  open: boolean;
  onClose: () => void;
  /** Localized modal title. */
  title: string;
  /** Prefix for `data-testid` (e.g. zone key or `itinerary-day-2`). */
  testIdKey: string;
  value: DenaliLocationDataForm;
  onConfirm: (coords: { latitude: number; longitude: number }) => void;
};

/** Leaflet map mounts only while `open` — avoids inline map instances in the wizard layout. */
export function DenaliLocationModalPicker({
  open,
  onClose,
  title,
  testIdKey,
  value,
  onConfirm,
}: DenaliLocationModalPickerProps) {
  const t = useTranslations("tours.denali");
  const { isSyncing } = useDenaliWizardSync();
  const [mapValue, setMapValue] = useState<DenaliMapCoordinates>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setMapValue(toMapCoordinates(value));
  }, [open, value.latitude, value.longitude]);

  const handleConfirm = () => {
    if (mapValue) {
      onConfirm({ latitude: mapValue.latitude, longitude: mapValue.longitude });
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      panelClassName="denali-location-modal-panel"
      footer={
        <Button
          type="button"
          variant="primary"
          onClick={handleConfirm}
          disabled={!mapValue || isSyncing}
          data-testid={`denali-location-${testIdKey}-modal-confirm`}
        >
          {t("basic.locationZones.confirmLocation")}
        </Button>
      }
    >
      {open ? (
        <DenaliLocationPickerMap
          value={mapValue}
          onChange={(coords) => setMapValue(coords)}
          height={360}
          data-testid={`denali-location-${testIdKey}-modal-map`}
        />
      ) : null}
    </Modal>
  );
}
