"use client";

import React, { useCallback, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCanonicalValue,
  setCanonicalValue,
} from "@/tours/tour-wizard-draft-path";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import type { WizardCompositeFieldRenderProps } from "@/wizard/wizard-surface-types";

import { uploadPlatformWizardPhoto } from "../platform-photo-upload-client";
import {
  newPlatformPhotoId,
  parsePlatformTourPhotos,
  PLATFORM_MAX_PHOTO_COUNT,
  type PlatformTourPhoto,
} from "../platform-photo-types";

type PlatformPhotosFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly canonicalPath: string;
  readonly required?: boolean;
  readonly wizardSessionId?: string;
};

function readPhotosFromDraft(draft: TourWizardDraft, canonicalPath: string): PlatformTourPhoto[] {
  return parsePlatformTourPhotos(getCanonicalValue(draft, canonicalPath));
}

export function PlatformPhotosField({
  draft,
  onDraftChange,
  canonicalPath,
  required = false,
  wizardSessionId,
}: PlatformPhotosFieldProps) {
  const uploadEnabled = wizardSessionId !== undefined && wizardSessionId.trim().length > 0;
  const photos = readPhotosFromDraft(draft, canonicalPath);
  const [uploadingPhotoIds, setUploadingPhotoIds] = useState<ReadonlySet<string>>(() => new Set());

  const mutatePhotos = useCallback(
    (transform: (current: readonly PlatformTourPhoto[]) => PlatformTourPhoto[]) => {
      onDraftChange(
        setCanonicalValue(draft, canonicalPath, transform(readPhotosFromDraft(draft, canonicalPath)))
      );
    },
    [canonicalPath, draft, onDraftChange]
  );

  const updatePhotoById = useCallback(
    (photoId: string, patch: Partial<PlatformTourPhoto>) => {
      const normalizedId = photoId.trim();
      mutatePhotos((current) =>
        current.map((photo) =>
          photo.id.trim() === normalizedId ? { ...photo, ...patch } : photo
        )
      );
    },
    [mutatePhotos]
  );

  const addPhoto = () => {
    mutatePhotos((current) => {
      if (current.length >= PLATFORM_MAX_PHOTO_COUNT) {
        return [...current];
      }
      return [...current, { id: newPlatformPhotoId(), caption: "" }];
    });
  };

  const removePhoto = (photoId: string) => {
    const normalizedId = photoId.trim();
    mutatePhotos((current) => current.filter((photo) => photo.id.trim() !== normalizedId));
  };

  const handleFileSelected = async (photoId: string, file: File | undefined) => {
    if (!uploadEnabled || file === undefined || wizardSessionId === undefined) {
      return;
    }
    const normalizedId = photoId.trim();
    setUploadingPhotoIds((previous) => new Set(previous).add(normalizedId));
    try {
      const result = await uploadPlatformWizardPhoto({
        sessionId: wizardSessionId,
        photoId: normalizedId,
        file,
      });
      updatePhotoById(normalizedId, {
        objectKey: result.objectKey,
        url: undefined,
      });
    } finally {
      setUploadingPhotoIds((previous) => {
        const next = new Set(previous);
        next.delete(normalizedId);
        return next;
      });
    }
  };

  return (
    <div
      className="platform-wizard-composite space-y-3"
      data-platform-photos-field=""
      data-photos-upload-disabled={uploadEnabled ? undefined : "true"}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Photos</h3>
        <p className="text-muted-foreground text-xs">
          Add up to {PLATFORM_MAX_PHOTO_COUNT} photos for this tour.
        </p>
      </div>

      {photos.map((photo) => {
        const photoId = photo.id.trim();
        const isUploading = uploadingPhotoIds.has(photoId);
        return (
          <section key={photo.id} className="space-y-2 rounded-md border p-3">
            <div className="space-y-1">
              <Label htmlFor={`${photoId}-caption`}>Caption</Label>
              <Input
                id={`${photoId}-caption`}
                value={photo.caption ?? ""}
                required={required}
                disabled={isUploading}
                onChange={(event) => updatePhotoById(photoId, { caption: event.target.value })}
              />
            </div>
            {uploadEnabled ? (
              <div className="space-y-1">
                <Label htmlFor={`${photoId}-upload`}>Upload image</Label>
                <Input
                  id={`${photoId}-upload`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isUploading}
                  onChange={(event) => void handleFileSelected(photoId, event.target.files?.[0])}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor={`${photoId}-url`}>Image URL</Label>
              <Input
                id={`${photoId}-url`}
                value={photo.url ?? ""}
                disabled={isUploading}
                onChange={(event) =>
                  updatePhotoById(photoId, {
                    url: event.target.value,
                    ...(event.target.value.trim().length > 0 ? { objectKey: undefined } : {}),
                  })
                }
              />
            </div>
            <Button type="button" variant="secondary" disabled={isUploading} onClick={() => removePhoto(photoId)}>
              Remove photo
            </Button>
          </section>
        );
      })}

      <Button type="button" variant="secondary" onClick={addPhoto} disabled={photos.length >= PLATFORM_MAX_PHOTO_COUNT}>
        Add photo
      </Button>
    </div>
  );
}

export function renderPlatformPhotosCompositeField(
  props: WizardCompositeFieldRenderProps
): ReactNode {
  return (
    <PlatformPhotosField
      draft={props.draft}
      onDraftChange={props.onDraftChange}
      canonicalPath={props.field.canonicalPath || "photos"}
      required={props.field.required}
      wizardSessionId={props.wizardSessionId}
    />
  );
}
