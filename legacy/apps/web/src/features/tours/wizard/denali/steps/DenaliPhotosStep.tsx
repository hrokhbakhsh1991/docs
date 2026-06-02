"use client";

import { DenaliRegistryFields } from "@/features/tours/denali/fields/DenaliRegistryFields";

export type DenaliPhotosStepProps = {
  tourId?: string;
};

export function DenaliPhotosStep({ tourId }: DenaliPhotosStepProps = {}) {
  return <DenaliRegistryFields sectionId="denali_photos" tourId={tourId} />;
}
