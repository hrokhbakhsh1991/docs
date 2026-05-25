"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField, Textarea } from "@tour/ui";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { useDenaliCanonicalValue } from "../hooks/useDenaliCanonicalValue";
import { DenaliItineraryDayLocationField } from "../components/DenaliItineraryDayLocationField";
import { DenaliItineraryDayPhotos } from "../components/DenaliItineraryDayPhotos";
import {
  computeDenaliTourDayCountFromKind,
  syncDenaliItineraryRows,
  type DenaliItineraryDayRow,
} from "../denaliItinerarySync";

const ITINERARY_DEBOUNCE_MS = 300;

function readItineraryPhotosError(itineraryErrors: unknown, index: number): string | undefined {
  if (!Array.isArray(itineraryErrors)) {
    return undefined;
  }
  const row = itineraryErrors[index] as
    | {
        photos?: { message?: string } | Array<{ url?: { message?: string }; id?: { message?: string } }>;
      }
    | undefined;
  const photos = row?.photos;
  if (!photos) {
    return undefined;
  }
  if (typeof photos === "object" && photos !== null && "message" in photos) {
    const message = (photos as { message?: string }).message;
    return typeof message === "string" ? message : undefined;
  }
  if (Array.isArray(photos)) {
    for (const entry of photos) {
      const urlMsg = entry?.url?.message;
      if (typeof urlMsg === "string" && urlMsg.trim() !== "") {
        return urlMsg;
      }
      const idMsg = entry?.id?.message;
      if (typeof idMsg === "string" && idMsg.trim() !== "") {
        return idMsg;
      }
    }
  }
  return undefined;
}

export function DenaliDailyItinerarySection() {
  const t = useTranslations("tours.denali");
  const {
    formState: { errors },
    getValues,
  } = useFormContext<DenaliCreateTourWizardForm>();

  const { updateCanonical } = useDenaliCanonical();
  const startDateTime = useDenaliCanonicalValue<string | undefined>("startDateTime");
  const endDateTime = useDenaliCanonicalValue<string | undefined>("endDateTime");
  const program = useDenaliCanonicalValue<DenaliCanonicalTourModel["program"]>("program");
  const form = getValues();
  const dayCount = computeDenaliTourDayCountFromKind(
    form.basicInfo.tourType,
    startDateTime ?? "",
    endDateTime,
  );
  const rows = useMemo(
    () => syncDenaliItineraryRows(program.itinerary, dayCount),
    [program.itinerary, dayCount],
  );

  const [draftRows, setDraftRows] = useState<DenaliItineraryDayRow[]>(rows);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canonicalProgramRef = useRef(program);

  canonicalProgramRef.current = program;

  useEffect(() => {
    setDraftRows(rows);
  }, [rows]);

  useLayoutEffect(() => {
    if ((program.itinerary?.length ?? 0) !== rows.length) {
      updateCanonical({ program: { ...program, itinerary: rows } });
    }
  }, [rows.length, program.itinerary?.length, program, updateCanonical]);

  const scheduleCommit = useCallback(
    (nextRows: DenaliItineraryDayRow[]) => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        updateCanonical({
          program: { ...canonicalProgramRef.current, itinerary: nextRows },
        });
      }, ITINERARY_DEBOUNCE_MS);
    },
    [updateCanonical],
  );

  useEffect(
    () => () => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  const itineraryErrors = errors.programNature?.itinerary;
  const rootMessage =
    itineraryErrors != null && typeof itineraryErrors === "object" && "message" in itineraryErrors
      ? String((itineraryErrors as { message?: string }).message ?? "")
      : undefined;

  return (
    <div style={{ display: "grid", gap: "0.75rem" }} data-testid="denali-daily-itinerary">
      {rootMessage ? (
        <p role="alert" style={{ margin: 0, color: "var(--color-danger-800, #991b1b)", fontSize: "0.85rem" }}>
          {rootMessage}
        </p>
      ) : null}
      {draftRows.map((row, index) => {
        const dayError = Array.isArray(itineraryErrors)
          ? itineraryErrors[index]?.activities?.message
          : undefined;
        const rowErrors = Array.isArray(itineraryErrors) ? itineraryErrors[index] : undefined;
        const locationFieldErrors = rowErrors?.location as
          | {
              addressText?: { message?: string };
              latitude?: { message?: string };
              longitude?: { message?: string };
            }
          | undefined;
        const photosError = readItineraryPhotosError(itineraryErrors, index);
        return (
          <div
            key={row.day}
            style={{
              display: "grid",
              gap: "0.5rem",
              padding: "0.65rem 0",
              borderTop: index > 0 ? "1px solid var(--color-border-subtle, #e2e8f0)" : undefined,
            }}
          >
            <DenaliItineraryDayLocationField
              day={row.day}
              value={row.location}
              fieldErrors={locationFieldErrors}
              onChange={(location, locationText) => {
                const next = draftRows.map((r, i) =>
                  i === index
                    ? {
                        ...r,
                        location,
                        locationText,
                      }
                    : r,
                );
                setDraftRows(next);
                scheduleCommit(next);
              }}
            />
            <FormField
              label={t("program.dailyActivitiesDay", { day: row.day })}
              error={dayError}
            >
              <Textarea
                rows={3}
                value={row.activities}
                onBlur={() => {
                  if (debounceRef.current != null) {
                    clearTimeout(debounceRef.current);
                    debounceRef.current = null;
                    updateCanonical({
                      program: { ...canonicalProgramRef.current, itinerary: draftRows },
                    });
                  }
                }}
                onChange={(e) => {
                  const next = draftRows.map((r, i) =>
                    i === index ? { ...r, activities: e.target.value } : r,
                  );
                  setDraftRows(next);
                  scheduleCommit(next);
                }}
                placeholder={t("program.dailyActivitiesPlaceholder")}
                data-testid={`denali-itinerary-day-${row.day}`}
              />
            </FormField>
            <DenaliItineraryDayPhotos
              day={row.day}
              photos={row.photos}
              label={t("program.dailyPhotosDay", { day: row.day })}
              hint={t("program.dailyPhotosHint")}
              error={photosError}
              onChange={(photos) => {
                const next = draftRows.map((r, i) =>
                  i === index ? { ...r, photos } : r,
                );
                setDraftRows(next);
                scheduleCommit(next);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
