"use client";

import { useCallback, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Alert, Button, FormField, Input } from "@tour/ui";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { DENALI_MAX_PHOTO_COUNT } from "@/features/tours/wizard/schemas/denaliFileAssetSchema";
import { uploadTourPhotos } from "@/lib/services/tours.service";

import { useDenaliCanonical, useDenaliStepFieldRules } from "@/features/tours/wizard/denali/application";
import { DenaliProgramContentSection } from "@/features/tours/denali/widgets/DenaliProgramContentSection";

const STEP = "denali_photos" as const;
const ACCEPT = "image/jpeg, image/png, image/webp";

type DenaliPhotosStepProps = {
  /** Edit mode: existing tour id. Create mode: omit — context creates a draft shell on first upload. */
  tourId?: string;
};

export function DenaliPhotosSection({ tourId: tourIdProp }: DenaliPhotosStepProps = {}) {
  const {
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const {
    updateCanonical,
    ensureUploadTourId,
    uploadTourId: contextUploadTourId,
    photoPersistenceWarning,
    clearPhotoPersistenceWarning,
    checkPhotoPersistence,
  } = useDenaliCanonical();
  const { isRequired } = useDenaliStepFieldRules(STEP);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const rows = useMemo(() => getValues().photosData.photos ?? [], [getValues]);
  const photoErrors = errors.photosData?.photos;
  const rootError = Array.isArray(photoErrors) ? undefined : photoErrors?.message;
  const required = isRequired("photos", getValues());
  const atLimit = rows.length >= DENALI_MAX_PHOTO_COUNT;

  const commitPhotos = useCallback(
    (next: DenaliCreateTourWizardForm["photosData"]["photos"]) => {
      setValue("photosData.photos", next, {
        shouldDirty: true,
        shouldValidate: true,
      });
      updateCanonical({ photos: next });
      clearPhotoPersistenceWarning();
      checkPhotoPersistence({ ...getValues(), photosData: { photos: next ?? [] } });
    },
    [checkPhotoPersistence, clearPhotoPersistenceWarning, getValues, setValue, updateCanonical],
  );

  const resolveUploadTourId = useCallback(async (): Promise<string> => {
    const fromProp = tourIdProp?.trim();
    if (fromProp) {
      return fromProp;
    }
    if (contextUploadTourId?.trim()) {
      return contextUploadTourId.trim();
    }
    return ensureUploadTourId();
  }, [contextUploadTourId, ensureUploadTourId, tourIdProp]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList?.length) return;

      const slots = Math.max(0, DENALI_MAX_PHOTO_COUNT - rows.length);
      const files = Array.from(fileList).slice(0, slots);
      if (files.length === 0) {
        e.target.value = "";
        return;
      }

      setUploading(true);
      setUploadError(null);
      try {
        const tourId = await resolveUploadTourId();
        const uploaded = await uploadTourPhotos(tourId, files);
        if (uploaded.length === 0) {
          setUploadError("آپلود عکس انجام نشد.");
          return;
        }
        const next = [...rows, ...uploaded];
        commitPhotos(next);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "آپلود عکس ناموفق بود.");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [commitPhotos, resolveUploadTourId, rows],
  );

  return (
    <div style={{ display: "grid", gap: "0.85rem" }} data-testid="denali-section-photos">
      <DenaliProgramContentSection />

      {photoPersistenceWarning ? (
        <Alert variant="warning" role="status" data-testid="denali-photos-persistence-warning">
          {photoPersistenceWarning}
        </Alert>
      ) : null}

      <FormField
        label={
          required
            ? "آپلود عکس (الزامی - حداکثر ۱۰ فایل، هر فایل ۵ مگابایت)"
            : "آپلود عکس (حداکثر ۱۰ فایل، هر فایل ۵ مگابایت)"
        }
        error={uploadError ?? rootError}
      >
        <Input
          type="file"
          multiple
          accept={ACCEPT}
          disabled={atLimit || uploading}
          onChange={(event) => void handleFileChange(event)}
          data-testid="denali-photos-upload-input"
        />
      </FormField>

      {uploading ? (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-slate-500)" }}>در حال آپلود…</p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "1rem",
          marginTop: "0.25rem",
        }}
        data-testid="denali-photos-container"
      >
        {rows.map((field, index) => (
          <div
            key={`${field.id}-${index}`}
            style={{
              border: "1px solid var(--color-slate-200)",
              borderRadius: "8px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- wizard photo preview uses blob/object URLs */}
            <img
              src={field.url}
              alt={field.filename}
              style={{ width: "100%", height: "150px", objectFit: "cover" }}
              data-testid={`denali-photos-preview-${index}`}
            />
            <div
              style={{
                padding: "0.5rem",
                background: "var(--color-slate-50)",
                fontSize: "0.75rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {field.filename}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              style={{ position: "absolute", top: "4px", right: "4px" }}
              onClick={() => {
                const next = rows.filter((_, i) => i !== index);
                commitPhotos(next);
              }}
              data-testid={`denali-photos-remove-${index}`}
            >
              حذف
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
