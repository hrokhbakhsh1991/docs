"use client";

import { DenaliPhotosStep } from "../steps/DenaliPhotosStep";

/** @deprecated Use {@link DenaliPhotosStep} with `tourId`. */
export function DenaliEditGalleryPhotos({ tourId }: { tourId: string }) {
  return <DenaliPhotosStep tourId={tourId} />;
}
