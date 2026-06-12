"use client";

import React, { useMemo } from "react";
import { useTranslations } from "next-intl";

import { DenaliPhotoPreview } from "./denali-photo-preview";
import type { DenaliTourPhoto } from "./denali-photo-types";
import {
  filterSelectableItineraryPhotos,
  readItineraryPhotoLabel,
  toggleItinerarySegmentPhotoSelection,
} from "./denali-itinerary-segment-photo-logic";

export const DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS = {
  picker: "denali-itinerary-segment-photo-picker",
  toggle: (photoId: string) => `denali-itinerary-segment-photo-${photoId}`,
} as const;

type DenaliItinerarySegmentPhotoPickerProps = {
  readonly photos: readonly DenaliTourPhoto[];
  readonly selectedIds: readonly string[];
  readonly dayNumber?: number;
  readonly onChange: (photoIds: string[]) => void;
};

export function DenaliItinerarySegmentPhotoPicker({
  photos,
  selectedIds,
  dayNumber,
  onChange,
}: DenaliItinerarySegmentPhotoPickerProps) {
  const t = useTranslations("denali");

  const selectablePhotos = useMemo(
    () => filterSelectableItineraryPhotos(photos, dayNumber),
    [dayNumber, photos]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const togglePhoto = (photoId: string) => {
    onChange(toggleItinerarySegmentPhotoSelection(selectedIds, photoId));
  };

  return (
    <div
      className="denali-wizard-composite__field denali-wizard-composite__segment-photo-picker"
      data-testid={DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS.picker}
    >
      <span>{t("composites.itinerary.segmentPhotos")}</span>
      {selectablePhotos.length === 0 ? (
        <p className="denali-wizard-composite__helper">{t("composites.itinerary.segmentPhotosEmpty")}</p>
      ) : (
        <div className="denali-wizard-composite__segment-photo-grid" role="group">
          {selectablePhotos.map((photo) => {
            const photoId = photo.id;
            const selected = selectedSet.has(photoId);
            const label = readItineraryPhotoLabel(photo, t("composites.photos.previewAlt"));
            return (
              <button
                key={photoId}
                type="button"
                className={
                  selected
                    ? "denali-wizard-composite__segment-photo-toggle is-selected"
                    : "denali-wizard-composite__segment-photo-toggle"
                }
                aria-pressed={selected}
                aria-label={t("composites.itinerary.segmentPhotoToggle", { label })}
                data-testid={DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS.toggle(photoId)}
                onClick={() => togglePhoto(photoId)}
              >
                <DenaliPhotoPreview
                  photo={photo}
                  altFallback={t("composites.photos.previewAlt")}
                  className="denali-wizard-composite__segment-photo-thumb"
                />
                <span className="denali-wizard-composite__segment-photo-label">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
