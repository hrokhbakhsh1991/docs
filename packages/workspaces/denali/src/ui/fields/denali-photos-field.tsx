"use client";

import { createClientSafeUuid } from "@app-tour/draft-engine";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isDenaliHttpsImageUrl } from "../../schemas/denaliFileAssetSchema";
import { isDenaliWizardDraftSessionId } from "../../draft";
import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  getCanonicalValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { resolveDenaliPhotoUploadError } from "../adapters/photo-upload-errors";
import { uploadDenaliWizardPhoto } from "../adapters/photo-upload-client";
import { trackDenaliPhotoUploadLifecycle } from "../logic/denali-photo-upload-tracker";
import { Button, Input, Select, type SelectOption } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { DenaliPhotoPreview } from "../components/denali-photo-preview";
import { DenaliOptionalEmptyNotice } from "../components/denali-optional-empty-notice";
import {
  buildDenaliPhotoDaySections,
  shouldDenaliPhotoDayDefaultOpen,
} from "../logic/denali-photo-day-grouping";
import {
  DENALI_MAX_PHOTO_COUNT,
  estimateDenaliTourDayCount,
  isDenaliMultiDayTourKind,
  parseDenaliTourPhotos,
  type DenaliTourPhoto,
} from "../logic/denali-photo-types";
import { DENALI_PHOTOS_TEST_IDS } from "../test-ids/denali-photos-test-ids";

export { DENALI_PHOTOS_TEST_IDS } from "../test-ids/denali-photos-test-ids";

type DenaliPhotosFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
  readonly wizardSessionId?: string;
  readonly invalid?: boolean;
};

type DenaliPhotoCardEditorProps = {
  readonly photo: DenaliTourPhoto;
  readonly photoId: string;
  readonly globalIndex: number;
  readonly multiDay: boolean;
  readonly dayOptions: readonly SelectOption[];
  readonly required: boolean;
  readonly uploadEnabled: boolean;
  readonly localPreviewUrl: string | null;
  readonly isUploading: boolean;
  readonly photoUploadError?: string;
  readonly fileInputRef: (element: HTMLInputElement | null) => void;
  readonly onDayChange: (day: number) => void;
  readonly onLabelChange: (label: string) => void;
  readonly onFileSelected: (file: File | undefined) => void;
  readonly onUrlChange: (url: string) => void;
  readonly onRemove: () => void;
};

function newPhotoId(): string {
  return createClientSafeUuid();
}

function readPhotosFromDraft(base: DenaliTourWizardDraft): DenaliTourPhoto[] {
  return parseDenaliTourPhotos(getCanonicalValue(base, "photos"));
}

function DenaliPhotoDaySection({
  day,
  dayCount,
  title,
  hint,
  emptyCopy,
  addLabel,
  canAdd,
  onAdd,
  testId,
  addTestId,
  itemCount,
  grid,
}: {
  readonly day: number;
  readonly dayCount: number;
  readonly title: string;
  readonly hint: string;
  readonly emptyCopy: string;
  readonly addLabel: string;
  readonly canAdd: boolean;
  readonly onAdd: () => void;
  readonly testId: string;
  readonly addTestId: string;
  readonly itemCount: number;
  readonly grid: ReactNode;
}) {
  const [open, setOpen] = useState(() => shouldDenaliPhotoDayDefaultOpen(day, dayCount));

  return (
    <details
      className="denali-wizard-composite__panel denali-photo-day-section"
      data-testid={testId}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="denali-wizard-composite__legend denali-photo-day-section__summary">
        {title}
        <span className="denali-photo-day-section__summary-hint">{" — "}{hint}</span>
      </summary>
      {itemCount === 0 ? <p className="denali-wizard-composite__status">{emptyCopy}</p> : grid}
      <Button
        type="button"
        variant="secondary"
        className="denali-wizard-composite__photo-day-add"
        data-testid={addTestId}
        onClick={onAdd}
        disabled={!canAdd}
      >
        {addLabel}
      </Button>
    </details>
  );
}

function DenaliPhotoCardEditor({
  photo,
  photoId,
  globalIndex,
  multiDay,
  dayOptions,
  required,
  uploadEnabled,
  localPreviewUrl,
  isUploading,
  photoUploadError,
  fileInputRef,
  onDayChange,
  onLabelChange,
  onFileSelected,
  onUrlChange,
  onRemove,
}: DenaliPhotoCardEditorProps) {
  const t = useTranslations("denali");
  const tCommon = useTranslations("denali.composites.common");
  const isTourCover = globalIndex === 0;

  return (
    <section
      className="denali-wizard-composite__photo-card"
      data-operator-photo-uploading={isUploading ? "true" : undefined}
      data-operator-photo-day={photo.day != null ? String(photo.day) : undefined}
      data-operator-photo-global-index={globalIndex}
    >
      <div className="denali-wizard-composite__photo-card-header">
        {isTourCover ? (
          <span
            className="denali-wizard-composite__photo-cover-badge"
            data-testid={DENALI_PHOTOS_TEST_IDS.coverBadge}
          >
            {t("composites.photos.tourCoverBadge")}
          </span>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="denali-wizard-composite__photo-remove"
          onClick={onRemove}
          disabled={isUploading || photoId.length === 0}
        >
          {t("composites.photos.removePhoto")}
        </Button>
      </div>
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
            aria-label={t("composites.photos.dayOption", { n: photo.day ?? 1 })}
            options={dayOptions}
            value={String(photo.day ?? 1)}
            onChange={(event) => onDayChange(Number.parseInt(event.target.value, 10))}
            disabled={isUploading || photoId.length === 0}
          />
        </label>
      ) : null}
      <label className="denali-wizard-composite__field">
        <span>{tCommon("label")}</span>
        <Input
          value={photo.label ?? ""}
          onChange={(event) => onLabelChange(event.target.value)}
          aria-required={required || undefined}
          disabled={isUploading || photoId.length === 0}
        />
      </label>
      {uploadEnabled ? (
        <>
          <label className="denali-wizard-composite__field denali-wizard-composite__photo-upload">
            <span>{t("composites.photos.uploadImage")}</span>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              data-operator-wizard-file-input
              data-testid={DENALI_PHOTOS_TEST_IDS.uploadInput}
              disabled={isUploading || photoId.length === 0}
              onChange={(event) => void onFileSelected(event.target.files?.[0])}
            />
          </label>
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
          {photoId.length > 0 && photoUploadError !== undefined ? (
            <p className="denali-wizard-composite__error" role="alert">
              {photoUploadError}
            </p>
          ) : null}
        </>
      ) : null}
      <label className="denali-wizard-composite__field">
        <span>
          {uploadEnabled ? t("composites.photos.orImageUrl") : t("composites.photos.imageUrl")}
        </span>
        <Input
          value={photo.url ?? ""}
          onChange={(event) => onUrlChange(event.target.value)}
          disabled={isUploading || photoId.length === 0}
        />
        {(photo.url?.trim().length ?? 0) > 0 && !isDenaliHttpsImageUrl(photo.url ?? "") ? (
          <p className="denali-wizard-composite__error" role="alert">
            {t("composites.photos.httpsUrlRequired")}
          </p>
        ) : null}
      </label>
    </section>
  );
}

export function DenaliPhotosField({
  draft,
  onDraftChange,
  required = false,
  wizardSessionId,
  invalid = false,
}: DenaliPhotosFieldProps) {
  const t = useTranslations("denali");
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

  const daySections = useMemo(() => {
    if (!multiDay || dayCount == null) {
      return [];
    }
    return buildDenaliPhotoDaySections(photos, dayCount);
  }, [dayCount, multiDay, photos]);

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

  const addPhoto = useCallback(
    (day?: number) => {
      mutatePhotos((current) => {
        if (current.length >= DENALI_MAX_PHOTO_COUNT) {
          return [...current];
        }
        return [
          ...current,
          {
            id: newPhotoId(),
            label: "",
            ...(multiDay && dayCount != null ? { day: day ?? 1 } : {}),
          },
        ];
      });
    },
    [dayCount, multiDay, mutatePhotos]
  );

  const removePhoto = useCallback(
    (photoId: string) => {
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
    },
    [mutatePhotos, revokeLocalPreview, setPhotoUploading]
  );

  const handleFileSelected = async (photoId: string, file: File | undefined) => {
    if (!uploadEnabled || file === undefined) {
      return;
    }
    const normalizedId = photoId.trim();
    if (normalizedId.length === 0) {
      return;
    }

    const rowExists = readPhotosFromDraft(draftRef.current).some(
      (photo) => photo.id?.trim() === normalizedId
    );
    if (!rowExists) {
      return;
    }

    setLocalPreview(normalizedId, file);
    setPhotoUploading(normalizedId, true);
    const releaseUploadTracker = trackDenaliPhotoUploadLifecycle();
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
      releaseUploadTracker();
      setPhotoUploading(normalizedId, false);
      const input = fileInputRefs.current[normalizedId];
      if (input !== null && input !== undefined) {
        input.value = "";
      }
    }
  };

  const renderPhotoCard = (photo: DenaliTourPhoto, globalIndex: number, showDaySelect: boolean) => {
    const photoId = photo.id?.trim() ?? "";
    const localPreviewUrl = photoId.length > 0 ? (localPreviews[photoId] ?? null) : null;
    const isUploading = photoId.length > 0 && uploadingPhotoIds.has(photoId);

    return (
      <DenaliPhotoCardEditor
        key={photo.id ?? `photo-${globalIndex}`}
        photo={photo}
        photoId={photoId}
        globalIndex={globalIndex}
        multiDay={showDaySelect}
        dayOptions={dayOptions}
        required={required}
        uploadEnabled={uploadEnabled}
        localPreviewUrl={localPreviewUrl}
        isUploading={isUploading}
        photoUploadError={photoId.length > 0 ? photoUploadErrors[photoId] : undefined}
        fileInputRef={(element) => {
          if (photoId.length > 0) {
            fileInputRefs.current[photoId] = element;
          }
        }}
        onDayChange={(day) => updatePhotoById(photoId, { day })}
        onLabelChange={(label) => updatePhotoById(photoId, { label })}
        onFileSelected={(file) => void handleFileSelected(photoId, file)}
        onUrlChange={(url) =>
          updatePhotoById(photoId, {
            url,
            ...(url.trim().length > 0 ? { storageKey: undefined, contentType: undefined } : {}),
          })
        }
        onRemove={() => removePhoto(photoId)}
      />
    );
  };

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-testid={DENALI_PHOTOS_TEST_IDS.photos}
      aria-invalid={invalid || undefined}
    >
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
        <DenaliOptionalEmptyNotice testId={DENALI_PHOTOS_TEST_IDS.optionalEmpty}>
          {multiDay ? t("composites.photos.dayEmpty") : t("composites.photos.optionalEmpty")}
        </DenaliOptionalEmptyNotice>
      ) : null}

      {multiDay && dayCount != null ? (
        <div
          className="denali-wizard-composite__photos-day-sections"
          data-testid={DENALI_PHOTOS_TEST_IDS.daySections}
        >
          {daySections.map((section) => (
            <DenaliPhotoDaySection
              key={section.day}
              day={section.day}
              dayCount={dayCount}
              title={t("composites.photos.daySectionTitle", { n: section.day })}
              hint={t("composites.photos.dayPhotoCount", { count: section.items.length })}
              emptyCopy={t("composites.photos.daySectionEmpty")}
              addLabel={t("composites.photos.addPhotoToDay", { n: section.day })}
              canAdd={photos.length < DENALI_MAX_PHOTO_COUNT}
              onAdd={() => addPhoto(section.day)}
              testId={DENALI_PHOTOS_TEST_IDS.daySection(section.day)}
              addTestId={DENALI_PHOTOS_TEST_IDS.addPhotoToDay(section.day)}
              itemCount={section.items.length}
              grid={
                <div
                  className="denali-wizard-composite__photos-day-grid"
                  data-operator-wizard-photo-grid
                  data-testid={DENALI_PHOTOS_TEST_IDS.dayGrid(section.day)}
                >
                  {section.items.map(({ photo, globalIndex }) =>
                    renderPhotoCard(photo, globalIndex, false)
                  )}
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <>
          <div className="denali-wizard-composite__photos-layout" data-operator-wizard-photo-grid>
            {photos.map((photo, index) => renderPhotoCard(photo, index, false))}
          </div>
          <Button
            type="button"
            variant="secondary"
            data-testid={DENALI_PHOTOS_TEST_IDS.addPhoto}
            onClick={() => addPhoto()}
            disabled={photos.length >= DENALI_MAX_PHOTO_COUNT}
          >
            {t("composites.photos.addPhoto")}
          </Button>
        </>
      )}
    </div>
  );
}
