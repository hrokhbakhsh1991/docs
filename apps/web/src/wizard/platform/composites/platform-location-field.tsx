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
  newPlatformLocationZoneId,
  parsePlatformLocationData,
  serializePlatformLocationData,
  type PlatformLocationData,
  type PlatformLocationZone,
} from "../platform-location-types";

type PlatformLocationFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly canonicalPath: string;
  readonly required?: boolean;
};

function readLocationFromDraft(draft: TourWizardDraft, canonicalPath: string): PlatformLocationData {
  return parsePlatformLocationData(getCanonicalValue(draft, canonicalPath));
}

export function PlatformLocationField({
  draft,
  onDraftChange,
  canonicalPath,
  required = false,
}: PlatformLocationFieldProps) {
  const location = readLocationFromDraft(draft, canonicalPath);
  const zones = location.zones ?? [];

  const writeLocation = useCallback(
    (next: PlatformLocationData) => {
      onDraftChange(setCanonicalValue(draft, canonicalPath, serializePlatformLocationData(next)));
    },
    [canonicalPath, draft, onDraftChange]
  );

  const updateAddress = (address: string) => {
    writeLocation({ ...location, address });
  };

  const updateZones = (transform: (current: readonly PlatformLocationZone[]) => PlatformLocationZone[]) => {
    writeLocation({ ...location, zones: transform(zones) });
  };

  const addZone = () => {
    updateZones((current) => [...current, { id: newPlatformLocationZoneId(), label: "" }]);
  };

  const removeZone = (zoneId: string) => {
    const normalizedId = zoneId.trim();
    updateZones((current) => current.filter((zone) => zone.id.trim() !== normalizedId));
  };

  const updateZone = (zoneId: string, patch: Partial<PlatformLocationZone>) => {
    const normalizedId = zoneId.trim();
    updateZones((current) =>
      current.map((zone) => (zone.id.trim() === normalizedId ? { ...zone, ...patch } : zone))
    );
  };

  return (
    <div className="platform-wizard-composite space-y-4" data-platform-location-field="">
      <div className="space-y-1">
        <Label htmlFor={`${canonicalPath}-address`}>Address</Label>
        <Input
          id={`${canonicalPath}-address`}
          value={location.address ?? ""}
          required={required}
          placeholder="Street, city, region"
          onChange={(event) => updateAddress(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Location zones</h3>
          <Button type="button" variant="secondary" size="sm" onClick={addZone}>
            Add zone
          </Button>
        </div>
        {zones.length === 0 ? (
          <p className="text-muted-foreground text-xs">No zones yet — add labels and optional coordinates.</p>
        ) : null}
        {zones.map((zone) => {
          const zoneId = zone.id.trim();
          return (
            <section key={zone.id} className="space-y-2 rounded-md border p-3">
              <div className="space-y-1">
                <Label htmlFor={`${zoneId}-label`}>Zone label</Label>
                <Input
                  id={`${zoneId}-label`}
                  value={zone.label}
                  onChange={(event) => updateZone(zoneId, { label: event.target.value })}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`${zoneId}-lat`}>Latitude (optional)</Label>
                  <Input
                    id={`${zoneId}-lat`}
                    inputMode="decimal"
                    value={zone.lat ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value.trim();
                      updateZone(zoneId, {
                        lat: raw.length === 0 ? undefined : Number.parseFloat(raw),
                      });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${zoneId}-lng`}>Longitude (optional)</Label>
                  <Input
                    id={`${zoneId}-lng`}
                    inputMode="decimal"
                    value={zone.lng ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value.trim();
                      updateZone(zoneId, {
                        lng: raw.length === 0 ? undefined : Number.parseFloat(raw),
                      });
                    }}
                  />
                </div>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => removeZone(zoneId)}>
                Remove zone
              </Button>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function renderPlatformLocationCompositeField(
  props: WizardCompositeFieldRenderProps
): ReactNode {
  return (
    <PlatformLocationField
      draft={props.draft}
      onDraftChange={props.onDraftChange}
      canonicalPath={props.field.canonicalPath || "location"}
      required={props.field.required}
    />
  );
}
