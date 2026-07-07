"use client";

import type { ReactNode } from "react";

import type { WizardCompositeFieldRenderProps } from "@/wizard/wizard-surface-types";

import { renderPlatformCompositeFallback } from "./platform-composite-fallback";
import { renderPlatformItineraryCompositeField } from "./composites/platform-itinerary-field";
import { renderPlatformLocationCompositeField } from "./composites/platform-location-field";
import { renderPlatformPhotosCompositeField } from "./composites/platform-photos-field";

type PlatformCompositeRenderer = (props: WizardCompositeFieldRenderProps) => ReactNode;

const PLATFORM_COMPOSITE_RENDERERS: Readonly<Record<string, PlatformCompositeRenderer>> = {
  "platform.photos": renderPlatformPhotosCompositeField,
  "platform.location": renderPlatformLocationCompositeField,
  "platform.itinerary": renderPlatformItineraryCompositeField,
};

export function resolvePlatformCompositeRenderer(compositeId: string): PlatformCompositeRenderer {
  const normalized = compositeId.trim();
  const known = PLATFORM_COMPOSITE_RENDERERS[normalized];
  if (known !== undefined) {
    return known;
  }
  return () => renderPlatformCompositeFallback(normalized);
}

export function isPlatformCompositeImplemented(compositeId: string): boolean {
  return normalizedCompositeId(compositeId) in PLATFORM_COMPOSITE_RENDERERS;
}

function normalizedCompositeId(compositeId: string): string {
  return compositeId.trim();
}
