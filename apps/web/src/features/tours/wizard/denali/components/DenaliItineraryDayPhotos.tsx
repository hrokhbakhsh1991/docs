"use client";

import { Button } from "@tour/ui";

import type { DenaliItineraryDayPhoto } from "../denaliItinerarySync";
import { FileUploadField } from "./FileUploadField";

const MAX_PHOTOS_PER_DAY = 3;

type DenaliItineraryDayPhotosProps = {
  day: number;
  photos: DenaliItineraryDayPhoto[] | undefined;
  onChange: (_photos: DenaliItineraryDayPhoto[] | undefined) => void;
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

  return (
    <div data-testid={`denali-itinerary-photos-${day}`}>
      <FileUploadField
        label={label}
        hint={hint}
        error={error}
        value={rows}
        maxFiles={MAX_PHOTOS_PER_DAY}
        dataTestId={`denali-itinerary-photos-upload-${day}`}
        onChange={(next) => onChange(next as DenaliItineraryDayPhoto[] | undefined)}
      />
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
                border: "1px solid var(--color-slate-200)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob/preview URLs are dynamic wizard uploads */}
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
