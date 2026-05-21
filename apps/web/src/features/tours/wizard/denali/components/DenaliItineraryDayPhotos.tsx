"use client";

import { Button, FormField, Input } from "@tour/ui";

import type { DenaliItineraryDayPhoto } from "../denaliItinerarySync";

const MAX_PHOTOS_PER_DAY = 3;

type DenaliItineraryDayPhotosProps = {
  day: number;
  photos: DenaliItineraryDayPhoto[] | undefined;
  onChange: (photos: DenaliItineraryDayPhoto[] | undefined) => void;
  label: string;
  hint?: string;
  error?: string;
};

export function DenaliItineraryDayPhotos({
  day,
  photos,
  onChange,
  label,
  hint,
  error,
}: DenaliItineraryDayPhotosProps) {
  const rows = photos ?? [];
  const atLimit = rows.length >= MAX_PHOTOS_PER_DAY;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos = await Promise.all(
      Array.from(files).map(async (file) => {
        const id = crypto.randomUUID();
        const mockUrl = URL.createObjectURL(file);
        return {
          id,
          url: mockUrl,
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
        } satisfies DenaliItineraryDayPhoto;
      }),
    );

    const slots = MAX_PHOTOS_PER_DAY - rows.length;
    const toAppend = newPhotos.slice(0, Math.max(0, slots));
    const next = [...rows, ...toAppend];
    onChange(next.length > 0 ? next : undefined);
    e.target.value = "";
  };

  return (
    <div data-testid={`denali-itinerary-photos-${day}`}>
      <FormField label={label} description={hint} error={error}>
        <Input
          type="file"
          multiple
          accept="image/jpeg, image/png, image/webp"
          disabled={atLimit}
          onChange={(e) => void handleFileChange(e)}
          data-testid={`denali-itinerary-photos-upload-${day}`}
        />
      </FormField>
      {rows.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginTop: "0.5rem",
          }}
        >
          {rows.map((photo, index) => (
            <div
              key={photo.id}
              style={{
                position: "relative",
                width: 72,
                height: 72,
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid #e2e8f0",
              }}
            >
              <img
                src={photo.url}
                alt={photo.filename ?? `day-${day}-photo-${index + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <Button
                type="button"
                variant="secondary"
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  minWidth: 0,
                  padding: "0.1rem 0.35rem",
                  fontSize: "0.65rem",
                }}
                onClick={() => {
                  const next = rows.filter((_, i) => i !== index);
                  onChange(next.length > 0 ? next : undefined);
                }}
                data-testid={`denali-itinerary-photos-remove-${day}-${index}`}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
