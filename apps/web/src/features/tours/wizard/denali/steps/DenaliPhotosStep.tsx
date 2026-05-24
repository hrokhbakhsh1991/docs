"use client";

import { useFormContext } from "react-hook-form";
import { Button } from "@tour/ui";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { DENALI_MAX_PHOTO_COUNT } from "@/features/tours/wizard/schemas/denaliFileAssetSchema";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { useDenaliStepFieldRules } from "../hooks/useDenaliStepFieldRules";
import { FileUploadField } from "../components/FileUploadField";

const STEP = "denali_photos" as const;
export function DenaliPhotosStep() {
  const {
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const { updateCanonical } = useDenaliCanonical();
  const { isRequired } = useDenaliStepFieldRules(STEP);

  const rows = getValues().photosData.photos ?? [];
  const photoErrors = errors.photosData?.photos;
  const rootError = Array.isArray(photoErrors) ? undefined : photoErrors?.message;
  const required = isRequired("photos", getValues());

  return (
    <div style={{ display: "grid", gap: "0.85rem" }} data-testid="denali-step-photos">
      <FileUploadField
        label={
          required
            ? "آپلود عکس (الزامی - حداکثر ۱۰ فایل، هر فایل ۵ مگابایت)"
            : "آپلود عکس (حداکثر ۱۰ فایل، هر فایل ۵ مگابایت)"
        }
        error={rootError}
        value={rows}
        maxFiles={DENALI_MAX_PHOTO_COUNT}
        dataTestId="denali-photos-container"
        onChange={(next) => {
          setValue("photosData.photos", next ?? [], {
            shouldDirty: true,
            shouldValidate: true,
          });
          updateCanonical({ photos: next ?? [] });
        }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
        {rows.map((field, index) => (
          <div key={`${field.id}-${index}`} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", position: "relative" }}>
            <img 
              src={field.url} 
              alt={field.filename} 
              style={{ width: "100%", height: "150px", objectFit: "cover" }}
              data-testid={`denali-photos-preview-${index}`}
            />
            <div style={{ padding: "0.5rem", background: "#f8fafc", fontSize: "0.75rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {field.filename}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              style={{ position: "absolute", top: "4px", right: "4px" }}
              onClick={() => {
                const next = rows.filter((_, i) => i !== index);
                setValue("photosData.photos", next, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                updateCanonical({ photos: next });
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
