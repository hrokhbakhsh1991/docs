"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { commitWizardDraftEdit, useLatestWizardDraft } from "@/wizard/use-latest-wizard-draft";

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
  uploading: "denali-composite-photos-uploading",
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

function readPhotosFromDraft(base: TourWizardDraft): DenaliTourPhoto[] {
  return parseDenaliTourPhotos(getCanonicalValue(base, "photos"));
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
  const draftRef = useLatestWizardDraft(draft);
  const photos = readPhotosFromDraft(draft);
  const tourKind = getCanonicalStringValue(draft, "category");
  const multiDay = isDenaliMultiDayTourKind(tourKind);
  const uploadEnabled =
    wizardSessionId !== undefined && isDenaliWizardDraftSessionId(wizardSessionId);
  /** Stable per photo.id — survives reorder/remove while another card uploads. */
  const [uploadingPhotoIds, setUploadingPhotoIds] = useState<ReadonlySet<string>>(() => new Set());
  const [photoUploadErrors, setPhotoUploadErrors] = useState<Record<string, string>>({});
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const localPreviewsRef = useRef(localPreviews);
  localPreviewsRef.current = localPreviews;

  useEffect(() => {
    return () => {
      for (const url of Object.values(localPreviewsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

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

  /**
   * All photos[] writes go through commitWizardDraftEdit + draftRef so a remote
   * draft merge during SYNCING is not overwritten by a stale render closure.
   */
  const mutatePhotos = useCallback(
    (transform: (current: readonly DenaliTourPhoto[]) => DenaliTourPhoto[]) => {
      commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
        setCanonicalValue(base, "photos", transform(readPhotosFromDraft(base)))
      );
    },
    [draftRef, onDraftChange]
  );

  const updatePhotoById = useCallback(
    (photoId: string, patch: Partial<DenaliTourPhoto>) => {
      const normalizedId = photoId.trim();
      mutatePhotos((current) =>
        current.map((photo) =>
          photo.id?.trim() === normalizedId ? { ...photo, ...patch } : photo
        )
      );
    },
    [mutatePhotos]
  );

  const setPhotoUploading = useCallback((photoId: string, uploading: boolean) => {
    const normalizedId = photoId.trim();
    setUploadingPhotoIds((previous) => {
      const next = new Set(previous);
      if (uploading) {
        next.add(normalizedId);
      } else {
        next.delete(normalizedId);
      }
      return next;
    });
  }, []);

  const revokeLocalPreview = useCallback((photoId: string | undefined) => {
    if (photoId === undefined || photoId.trim().length === 0) {
      return;
    }
    const normalizedId = photoId.trim();
    setLocalPreviews((previous) => {
      const existing = previous[normalizedId];
      if (existing === undefined) {
        return previous;
      }
      URL.revokeObjectURL(existing);
      const next = { ...previous };
      delete next[normalizedId];
      return next;
    });
  }, []);

  const setLocalPreview = useCallback((photoId: string, file: File) => {
    const normalizedId = photoId.trim();
    setLocalPreviews((previous) => {
      const existing = previous[normalizedId];
      if (existing !== undefined) {
        URL.revokeObjectURL(existing);
      }
      return { ...previous, [normalizedId]: URL.createObjectURL(file) };
    });
  }, []);

  const addPhoto = () => {
    mutatePhotos((current) => {
      if (current.length >= DENALI_MAX_PHOTO_COUNT) {
        return [...current];
      }
      return [
        ...current,
        {
          id: newPhotoId(),
          label: "",
          ...(multiDay && dayCount != null ? { day: 1 } : {}),
        },
      ];
    });
  };

  const removePhoto = (photoId: string) => {
    const normalizedId = photoId.trim();
    if (normalizedId.length === 0) {
      return;
    }
    revokeLocalPreview(normalizedId);
    setPhotoUploadErrors((previous) => {
      const next = { ...previous };
      delete next[normalizedId];
      return next;
    });
    setPhotoUploading(normalizedId, false);
    mutatePhotos((current) => current.filter((photo) => photo.id?.trim() !== normalizedId));
  };

  const handleFileSelected = async (photoId: string, file: File | undefined) => {
    if (!uploadEnabled || file === undefined) {
      return;
    }
    const normalizedId = photoId.trim();
    if (normalizedId.length === 0) {
      return;
    }

    // Capture id up front; after await we patch by id against draftRef, not array index.
    const rowExists = readPhotosFromDraft(draftRef.current).some(
      (photo) => photo.id?.trim() === normalizedId
    );
    if (!rowExists) {
      return;
    }

    setLocalPreview(normalizedId, file);
    setPhotoUploading(normalizedId, true);
    setPhotoUploadErrors((previous) => {
      const next = { ...previous };
      delete next[normalizedId];
      return next;
    });

    try {
      const result = await uploadDenaliWizardPhoto({
        sessionId: wizardSessionId!,
        photoId: normalizedId,
        file,
      });
      updatePhotoById(normalizedId, {
        storageKey: result.storageKey,
        contentType: result.contentType,
        url: undefined,
      });
      revokeLocalPreview(normalizedId);
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : null;
      const message =
        resolveDenaliPhotoUploadError(t, code) || t("composites.photos.uploadFailed");
      setPhotoUploadErrors((previous) => ({ ...previous, [normalizedId]: message }));
    } finally {
      setPhotoUploading(normalizedId, false);
      const input = fileInputRefs.current[normalizedId];
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

      {photos.length === 0 ? (
        <p className="denali-wizard-composite__helper">{t("composites.photos.noPhotos")}</p>
      ) : null}

      <div className="denali-wizard-composite__photos-layout" data-denali-wizard-photo-grid>
        {photos.map((photo, index) => {
          const photoId = photo.id?.trim() ?? "";
          const localPreviewUrl = photoId.length > 0 ? (localPreviews[photoId] ?? null) : null;
          const isUploading = photoId.length > 0 && uploadingPhotoIds.has(photoId);

          return (
            <section
              key={photo.id ?? `photo-${index}`}
              className="denali-wizard-composite__photo-card"
              data-denali-photo-uploading={isUploading ? "true" : undefined}
            >
              <DenaliPhotoPreview
                photo={photo}
                altFallback={t("composites.photos.previewAlt")}
                localPreviewUrl={localPreviewUrl}
                isUploading={isUploading}
              />
              {multiDay && dayOptions.length > 0 ? (
                <label className="denali-wizard-composite__field">
                  <span>{t("composites.photos.dayLabel")}</span>
                  <Select
                    aria-label={t("composites.photos.dayOption", { n: index + 1 })}
                    options={dayOptions}
                    value={String(photo.day ?? 1)}
                    onChange={(event) =>
                      updatePhotoById(photoId, { day: Number.parseInt(event.target.value, 10) })
                    }
                    disabled={isUploading || photoId.length === 0}
                  />
                </label>
              ) : null}
              <label className="denali-wizard-composite__field">
                <span>{tCommon("label")}</span>
                <Input
                  value={photo.label ?? ""}
                  onChange={(event) => updatePhotoById(photoId, { label: event.target.value })}
                  aria-required={required || undefined}
                  disabled={isUploading || photoId.length === 0}
                />
              </label>
              {uploadEnabled ? (
                <label className="denali-wizard-composite__field">
                  <span>{t("composites.photos.uploadImage")}</span>
                  <Input
                    ref={(element) => {
                      if (photoId.length > 0) {
                        fileInputRefs.current[photoId] = element;
                      }
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    data-denali-wizard-file-input
                    data-testid={DENALI_PHOTOS_TEST_IDS.uploadInput}
                    disabled={isUploading || photoId.length === 0}
                    onChange={(event) => void handleFileSelected(photoId, event.target.files?.[0])}
                  />
                  {isUploading ? (
                    <p
                      className="denali-wizard-composite__helper"
                      role="status"
                      data-testid={DENALI_PHOTOS_TEST_IDS.uploading}
                    >
                      {t("composites.photos.uploading")}
                    </p>
                  ) : null}
                  {photo.storageKey ? (
                    <p className="denali-wizard-composite__helper">
                      {t("composites.photos.storedInObjectStorage")}
                    </p>
                  ) : null}
                  {photoId.length > 0 && photoUploadErrors[photoId] !== undefined ? (
                    <p className="denali-wizard-composite__error" role="alert">
                      {photoUploadErrors[photoId]}
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
                    updatePhotoById(photoId, {
                      url: event.target.value,
                      ...(event.target.value.trim().length > 0
                        ? { storageKey: undefined, contentType: undefined }
                        : {}),
                    })
                  }
                  disabled={isUploading || photoId.length === 0}
                />
                {(photo.url?.trim().length ?? 0) > 0 &&
                !isDenaliHttpsImageUrl(photo.url ?? "") ? (
                  <p className="denali-wizard-composite__error" role="alert">
                    {t("composites.photos.httpsUrlRequired")}
                  </p>
                ) : null}
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => removePhoto(photoId)}
                disabled={isUploading || photoId.length === 0}
              >
                {t("composites.photos.removePhoto")}
              </Button>
            </section>
          );
        })}
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
