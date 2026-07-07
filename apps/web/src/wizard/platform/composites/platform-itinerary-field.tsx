"use client";

import React, { useCallback, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCanonicalValue,
  setCanonicalValue,
} from "@/tours/tour-wizard-draft-path";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import type { WizardCompositeFieldRenderProps } from "@/wizard/wizard-surface-types";

import {
  appendPlatformItineraryDay,
  parsePlatformItineraryData,
  serializePlatformItineraryData,
  type PlatformItineraryData,
  type PlatformItineraryDay,
  type PlatformItinerarySegment,
} from "../platform-itinerary-types";

type PlatformItineraryFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly canonicalPath: string;
};

function readItineraryFromDraft(draft: TourWizardDraft, canonicalPath: string): PlatformItineraryData {
  return parsePlatformItineraryData(getCanonicalValue(draft, canonicalPath));
}

export function PlatformItineraryField({
  draft,
  onDraftChange,
  canonicalPath,
}: PlatformItineraryFieldProps) {
  const itinerary = readItineraryFromDraft(draft, canonicalPath);

  const writeItinerary = useCallback(
    (next: PlatformItineraryData) => {
      onDraftChange(setCanonicalValue(draft, canonicalPath, serializePlatformItineraryData(next)));
    },
    [canonicalPath, draft, onDraftChange]
  );

  const updateDays = (transform: (current: readonly PlatformItineraryDay[]) => PlatformItineraryDay[]) => {
    writeItinerary({ days: transform(itinerary.days) });
  };

  const addDay = () => {
    writeItinerary(appendPlatformItineraryDay(itinerary));
  };

  const updateDay = (dayIndex: number, patch: Partial<PlatformItineraryDay>) => {
    updateDays((current) =>
      current.map((day) => (day.dayIndex === dayIndex ? { ...day, ...patch } : day))
    );
  };

  const updateSegment = (
    dayIndex: number,
    segmentIndex: number,
    patch: Partial<PlatformItinerarySegment>
  ) => {
    updateDays((current) =>
      current.map((day) => {
        if (day.dayIndex !== dayIndex) {
          return day;
        }
        const segments = [...(day.segments ?? [])];
        const existing = segments[segmentIndex] ?? { destination: "", notes: "" };
        segments[segmentIndex] = { ...existing, ...patch };
        return { ...day, segments };
      })
    );
  };

  const addSegment = (dayIndex: number) => {
    updateDays((current) =>
      current.map((day) =>
        day.dayIndex === dayIndex
          ? { ...day, segments: [...(day.segments ?? []), { destination: "", notes: "" }] }
          : day
      )
    );
  };

  return (
    <div className="platform-wizard-composite space-y-4" data-platform-itinerary-field="">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Itinerary days</h3>
        <Button type="button" variant="secondary" size="sm" onClick={addDay}>
          Add day
        </Button>
      </div>

      {itinerary.days.length === 0 ? (
        <p className="text-muted-foreground text-xs">No itinerary days yet.</p>
      ) : null}

      {itinerary.days.map((day) => (
        <section key={day.dayIndex} className="space-y-3 rounded-md border p-3">
          <div className="space-y-1">
            <Label htmlFor={`day-${day.dayIndex}-title`}>Day {day.dayIndex} title</Label>
            <Input
              id={`day-${day.dayIndex}-title`}
              value={day.title ?? ""}
              onChange={(event) => updateDay(day.dayIndex, { title: event.target.value })}
            />
          </div>
          {(day.segments ?? []).map((segment, segmentIndex) => (
            <div key={`${day.dayIndex}-${segmentIndex}`} className="space-y-2 rounded border p-2">
              <div className="space-y-1">
                <Label htmlFor={`day-${day.dayIndex}-seg-${segmentIndex}-dest`}>Destination</Label>
                <Input
                  id={`day-${day.dayIndex}-seg-${segmentIndex}-dest`}
                  value={segment.destination ?? ""}
                  onChange={(event) =>
                    updateSegment(day.dayIndex, segmentIndex, { destination: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`day-${day.dayIndex}-seg-${segmentIndex}-notes`}>Notes</Label>
                <Input
                  id={`day-${day.dayIndex}-seg-${segmentIndex}-notes`}
                  value={segment.notes ?? ""}
                  onChange={(event) =>
                    updateSegment(day.dayIndex, segmentIndex, { notes: event.target.value })
                  }
                />
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={() => addSegment(day.dayIndex)}>
            Add segment
          </Button>
        </section>
      ))}
    </div>
  );
}

export function renderPlatformItineraryCompositeField(
  props: WizardCompositeFieldRenderProps
): ReactNode {
  return (
    <PlatformItineraryField
      draft={props.draft}
      onDraftChange={props.onDraftChange}
      canonicalPath={props.field.canonicalPath || "itinerary.days"}
    />
  );
}
