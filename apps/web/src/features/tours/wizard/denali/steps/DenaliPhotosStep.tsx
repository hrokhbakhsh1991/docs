"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { FormField, Input, Button } from "@tour/ui";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

export function DenaliPhotosStep() {
  const { control, formState: { errors } } = useFormContext<DenaliCreateTourWizardForm>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "photosData.photos",
  });

  const photoErrors = errors.photosData?.photos;
  const rootError = Array.isArray(photoErrors) ? undefined : photoErrors?.message;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Simulate async upload
    const newPhotos = await Promise.all(
      Array.from(files).map(async (file) => {
        const id = crypto.randomUUID();
        // Zod URL validation requires a valid URL (http/https). 
        // Using blob URL for now until the actual API is wired up.
        const mockUrl = URL.createObjectURL(file);
        
        return {
          id,
          url: mockUrl,
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
        };
      })
    );

    // Respect max 10 photos limit roughly here before upload
    const availableSlots = 10 - fields.length;
    const toAppend = newPhotos.slice(0, availableSlots);
    
    append(toAppend);
    
    // Clear input
    e.target.value = "";
  };

  return (
    <div style={{ display: "grid", gap: "0.85rem" }} data-testid="denali-step-photos">
      <div data-testid="denali-photos-container">
        <FormField label={"آپلود عکس (حداکثر ۱۰ فایل، هر فایل ۵ مگابایت)"} error={rootError}>
          <Input
            type="file"
            multiple
            accept="image/jpeg, image/png, image/webp"
            onChange={handleFileChange}
            data-testid="denali-photos-upload"
          />
        </FormField>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
        {fields.map((field, index) => (
          <div key={field.id} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", position: "relative" }}>
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
                // TODO: Phase 3 - Call API to delete if it was uploaded
                remove(index);
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
