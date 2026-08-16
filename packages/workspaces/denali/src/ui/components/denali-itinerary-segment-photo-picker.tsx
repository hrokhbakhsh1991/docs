"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { DenaliTourPhoto } from "../logic/denali-photo-types";
import {
  filterSelectableItineraryPhotos,
  readItineraryPhotoLabel,
  toggleItinerarySegmentPhotoSelection,
} from "../logic/denali-itinerary-segment-photo-logic";
import { DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS } from "../test-ids/denali-photos-test-ids";
import { DenaliOptionalEmptyNotice } from "./denali-optional-empty-notice";
import { DenaliPhotoPreview } from "./denali-photo-preview";

export { DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS } from "../test-ids/denali-photos-test-ids";

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
        <DenaliOptionalEmptyNotice testId={DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS.empty}>
          {`${t("composites.itinerary.segmentPhotosEmpty")} ${t("composites.itinerary.segmentPhotosGoToPhotos")}`}
        </DenaliOptionalEmptyNotice>
      ) : (
        <div className="denali-wizard-composite__segment-photo-grid" role="group">
          {selectablePhotos.map((photo) => {
            const photoId = photo.id;
            const selected = photoId != null && selectedSet.has(photoId);
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
                data-testid={
                  photoId != null
                    ? DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS.toggle(photoId)
                    : undefined
                }
                onClick={() => {
                  if (photoId != null) {
                    togglePhoto(photoId);
                  }
                }}
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
