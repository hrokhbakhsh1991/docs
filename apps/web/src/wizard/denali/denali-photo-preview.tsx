"use client";

import React, { useEffect, useState } from "react";
import { isDenaliHttpsImageUrl } from "@app-tour/workspace-denali/schemas/file-asset";

import { resolveDenaliWizardPhotoPreviewUrl } from "./denali-photo-upload-client";
import type { DenaliTourPhoto } from "./denali-photo-types";

export const DENALI_PHOTO_PREVIEW_TEST_ID = "denali-composite-photos-preview";

type DenaliPhotoPreviewProps = {
  readonly photo: DenaliTourPhoto;
  readonly altFallback: string;
  readonly className?: string;
  readonly testId?: string;
};

export function DenaliPhotoPreview({
  photo,
  altFallback,
  className = "denali-wizard-composite__preview-img",
  testId = DENALI_PHOTO_PREVIEW_TEST_ID,
}: DenaliPhotoPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const externalUrl = photo.url?.trim() ?? "";
    const storageKey = photo.storageKey?.trim() ?? "";

    if (externalUrl.length > 0) {
      setPreviewUrl(isDenaliHttpsImageUrl(externalUrl) ? externalUrl : null);
      return () => {
        cancelled = true;
      };
    }

    if (storageKey.length === 0) {
      setPreviewUrl(null);
      return () => {
        cancelled = true;
      };
    }

    void resolveDenaliWizardPhotoPreviewUrl(storageKey).then((url) => {
      if (!cancelled) {
        setPreviewUrl(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [photo.storageKey, photo.url]);

  if (previewUrl === null) {
    return null;
  }

  return (
    <img
      src={previewUrl}
      alt={photo.label?.trim() || altFallback}
      className={className}
      data-testid={testId}
    />
  );
}
