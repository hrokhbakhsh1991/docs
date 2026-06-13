"use client";

import React, { useMemo, useRef, useState } from "react";
import { Button } from "@app-tour/ui-primitives/button";
import { Input } from "@app-tour/ui-primitives/input";
import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import { isDenaliHttpsImageUrl } from "@app-tour/workspace-denali/schemas/file-asset";
import { isDenaliWizardDraftSessionId } from "@app-tour/workspace-denali/draft";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import { resolveDenaliPhotoUploadError } from "@/i18n/resolve-denali-photo-upload-error";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import { DenaliPhotoPreview } from "./denali-photo-preview";
import { uploadDenaliWizardPhoto } from "./denali-photo-upload-client";
import {
  DENALI_MAX_PHOTO_COUNT,
  estimateDenaliTourDayCount,
  isDenaliMultiDayTourKind,
  parseDenaliTourPhotos,
  type DenaliTourPhoto,
} from "./denali-photo-types";

export const DENALI_PHOTOS_TEST_IDS = {
  photos: "denali-composite-photos",
  addPhoto: "denali-composite-photos-add",
  uploadInput: "denali-composite-photos-upload",
  preview: "denali-composite-photos-preview",
} as const;

type DenaliPhotosFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
  readonly wizardSessionId?: string;
};

function newPhotoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DenaliPhotosField({
  draft,
  onDraftChange,
  required = false,
  wizardSessionId,
}: DenaliPhotosFieldProps) {
  const t = useTranslations("denali");
  const tCommon = useTranslations("denali.composites.common");
  const label = resolveDenaliFieldLabel(t, "photos");
  const photos = parseDenaliTourPhotos(getCanonicalValue(draft, "photos"));
  const tourKind = getCanonicalStringValue(draft, "category");
  const multiDay = isDenaliMultiDayTourKind(tourKind);
  const uploadEnabled =
    wizardSessionId !== undefined && isDenaliWizardDraftSessionId(wizardSessionId);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const dayCount = useMemo(() => {
    if (!multiDay) return undefined;
    const itinerary = getCanonicalValue(draft, "program.itinerary");
    if (Array.isArray(itinerary) && itinerary.length >= 2) {
      return itinerary.length;
    }
    return estimateDenaliTourDayCount(
      getCanonicalStringValue(draft, "startDateTime"),
      getCanonicalStringValue(draft, "endDateTime")
    );
  }, [draft, multiDay]);

  const dayOptions: readonly SelectOption[] = useMemo(() => {
    if (!multiDay || dayCount == null) {
      return [];
    }
    return Array.from({ length: dayCount }, (_, index) => ({
      value: String(index + 1),
      label: t("composites.photos.dayOption", { n: index + 1 }),
    }));
  }, [dayCount, multiDay, t]);

  const writePhotos = (nextPhotos: DenaliTourPhoto[]) => {
    onDraftChange(setCanonicalValue(draft, "photos", nextPhotos));
  };

  const updatePhoto = (index: number, patch: Partial<DenaliTourPhoto>) => {
    writePhotos(photos.map((photo, photoIndex) => (photoIndex === index ? { ...photo, ...patch } : photo)));
  };

  const addPhoto = () => {
    if (photos.length >= DENALI_MAX_PHOTO_COUNT) {
      return;
    }
    writePhotos([
      ...photos,
      {
        id: newPhotoId(),
        label: "",
        ...(multiDay && dayCount != null ? { day: 1 } : {}),
      },
    ]);
  };

  const removePhoto = (index: number) => {
    writePhotos(photos.filter((_, photoIndex) => photoIndex !== index));
  };

  const handleFileSelected = async (index: number, file: File | undefined) => {
    if (!uploadEnabled || file === undefined) {
      return;
    }
    const photo = photos[index];
    const photoId = photo?.id?.trim() ?? "";
    if (photoId.length === 0) {
      setUploadError(t("composites.photos.missingPhotoId"));
      return;
    }

    setUploadingIndex(index);
    setUploadError(null);
    try {
      const result = await uploadDenaliWizardPhoto({
        sessionId: wizardSessionId!,
        photoId,
        file,
      });
      updatePhoto(index, {
        storageKey: result.storageKey,
        contentType: result.contentType,
        url: undefined,
      });
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : null;
      const message =
        resolveDenaliPhotoUploadError(t, code) || t("composites.photos.uploadFailed");
      setUploadError(message);
    } finally {
      setUploadingIndex(null);
      const input = fileInputRefs.current[index];
      if (input !== null && input !== undefined) {
        input.value = "";
      }
    }
  };

  return (
    <div className="denali-wizard-composite" data-denali-wizard-surface="section" data-testid={DENALI_PHOTOS_TEST_IDS.photos}>
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        {multiDay ? (
          <p className="denali-wizard-composite__helper">
            {t("composites.photos.multiDayHelperWithMax", { max: DENALI_MAX_PHOTO_COUNT })}
          </p>
        ) : (
          <p className="denali-wizard-composite__helper">
            {t("composites.photos.singleDayHelper", { max: DENALI_MAX_PHOTO_COUNT })}
          </p>
        )}
      </div>

      {uploadError !== null ? (
        <p className="denali-wizard-composite__error" role="alert">
          {uploadError}
        </p>
      ) : null}

      {photos.length === 0 ? (
        <p className="denali-wizard-composite__helper">{t("composites.photos.noPhotos")}</p>
      ) : null}

      <div className="denali-wizard-composite__photos-layout" data-denali-wizard-photo-grid>
        {photos.map((photo, index) => (
          <section
            key={photo.id ?? `photo-${index}`}
            className="denali-wizard-composite__photo-card"
          >
            <DenaliPhotoPreview
              photo={photo}
              altFallback={t("composites.photos.previewAlt")}
            />
            {multiDay && dayOptions.length > 0 ? (
              <label className="denali-wizard-composite__field">
                <span>{t("composites.photos.dayLabel")}</span>
                <Select
                  aria-label={t("composites.photos.dayOption", { n: index + 1 })}
                  options={dayOptions}
                  value={String(photo.day ?? 1)}
                  onChange={(event) =>
                    updatePhoto(index, { day: Number.parseInt(event.target.value, 10) })
                  }
                />
              </label>
            ) : null}
            <label className="denali-wizard-composite__field">
              <span>{tCommon("label")}</span>
              <Input
                value={photo.label ?? ""}
                onChange={(event) => updatePhoto(index, { label: event.target.value })}
                aria-required={required || undefined}
              />
            </label>
            {uploadEnabled ? (
              <label className="denali-wizard-composite__field">
                <span>{t("composites.photos.uploadImage")}</span>
                <Input
                  ref={(element) => {
                    fileInputRefs.current[index] = element;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  data-denali-wizard-file-input
                  data-testid={DENALI_PHOTOS_TEST_IDS.uploadInput}
                  disabled={uploadingIndex === index}
                  onChange={(event) => void handleFileSelected(index, event.target.files?.[0])}
                />
                {photo.storageKey ? (
                  <p className="denali-wizard-composite__helper">
                    {t("composites.photos.storedInObjectStorage")}
                  </p>
                ) : null}
              </label>
            ) : null}
            <label className="denali-wizard-composite__field">
              <span>
                {uploadEnabled
                  ? t("composites.photos.orImageUrl")
                  : t("composites.photos.imageUrl")}
              </span>
              <Input
                value={photo.url ?? ""}
                onChange={(event) =>
                  updatePhoto(index, {
                    url: event.target.value,
                    ...(event.target.value.trim().length > 0
                      ? { storageKey: undefined, contentType: undefined }
                      : {}),
                  })
                }
              />
              {(photo.url?.trim().length ?? 0) > 0 &&
              !isDenaliHttpsImageUrl(photo.url ?? "") ? (
                <p className="denali-wizard-composite__error" role="alert">
                  {t("composites.photos.httpsUrlRequired")}
                </p>
              ) : null}
            </label>
            <Button type="button" variant="secondary" onClick={() => removePhoto(index)}>
              {t("composites.photos.removePhoto")}
            </Button>
          </section>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        data-testid={DENALI_PHOTOS_TEST_IDS.addPhoto}
        onClick={addPhoto}
        disabled={photos.length >= DENALI_MAX_PHOTO_COUNT}
      >
        {t("composites.photos.addPhoto")}
      </Button>
    </div>
  );
}
