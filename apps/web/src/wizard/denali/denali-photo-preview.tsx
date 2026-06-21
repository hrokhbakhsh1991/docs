"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@app-tour/ui-primitives/button";
import { isDenaliHttpsImageUrl } from "@app-tour/workspace-denali/schemas/file-asset";
import { useTranslations } from "next-intl";

import { resolveDenaliPhotoUploadError } from "@/i18n/resolve-denali-photo-upload-error";

import { resolveDenaliWizardPhotoPreviewUrl } from "./denali-photo-upload-client";
import type { DenaliTourPhoto } from "./denali-photo-types";

export const DENALI_PHOTO_PREVIEW_TEST_ID = "denali-composite-photos-preview";
export const DENALI_PHOTO_PREVIEW_FALLBACK_TEST_ID = "denali-composite-photos-preview-fallback";
export const DENALI_PHOTO_PREVIEW_RETRY_TEST_ID = "denali-composite-photos-preview-retry";

type DenaliPhotoPreviewProps = {
  readonly photo: DenaliTourPhoto;
  readonly altFallback: string;
  readonly className?: string;
  readonly testId?: string;
  /** Blob URL from parent — immediate preview before MinIO upload completes. */
  readonly localPreviewUrl?: string | null;
  readonly isUploading?: boolean;
};

export function DenaliPhotoPreview({
  photo,
  altFallback,
  className = "denali-wizard-composite__preview-img",
  testId = DENALI_PHOTO_PREVIEW_TEST_ID,
  localPreviewUrl = null,
  isUploading = false,
}: DenaliPhotoPreviewProps) {
  const t = useTranslations("denali");
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [fetchErrorCode, setFetchErrorCode] = useState<string | null>(null);
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const localUrl = localPreviewUrl?.trim() ?? "";
  const externalUrl = photo.url?.trim() ?? "";
  const storageKey = photo.storageKey?.trim() ?? "";
  const alt = photo.label?.trim() || altFallback;

  const loadSignedUrl = useCallback(async () => {
    if (storageKey.length === 0) {
      setRemoteUrl(null);
      setFetchErrorCode(null);
      return;
    }
    setFetchErrorCode(null);
    setImgLoadFailed(false);
    const result = await resolveDenaliWizardPhotoPreviewUrl(storageKey);
    if (result.ok) {
      setRemoteUrl(result.url);
      return;
    }
    setRemoteUrl(null);
    setFetchErrorCode(result.code);
  }, [storageKey]);

  useEffect(() => {
    if (localUrl.length > 0) {
      return;
    }
    if (externalUrl.length > 0) {
      setRemoteUrl(isDenaliHttpsImageUrl(externalUrl) ? externalUrl : null);
      setFetchErrorCode(
        externalUrl.length > 0 && !isDenaliHttpsImageUrl(externalUrl)
          ? "PHOTO_PREVIEW_HTTPS_REQUIRED"
          : null
      );
      setImgLoadFailed(false);
      return;
    }
    if (storageKey.length === 0) {
      setRemoteUrl(null);
      setFetchErrorCode(null);
      setImgLoadFailed(false);
      return;
    }
    void loadSignedUrl();
  }, [externalUrl, localUrl, storageKey, loadSignedUrl, retryNonce]);

  const displayUrl =
    localUrl.length > 0 ? localUrl : imgLoadFailed || fetchErrorCode !== null ? null : remoteUrl;

  const showFallback =
    displayUrl === null &&
    !isUploading &&
    (externalUrl.length > 0 || storageKey.length > 0);

  if (displayUrl !== null) {
    return (
      <>
        <img
          src={displayUrl}
          alt={alt}
          className={className}
          data-testid={testId}
          data-denali-photo-preview={isUploading ? "uploading" : "ready"}
          onError={() => {
            if (localUrl.length > 0) {
              return;
            }
            setImgLoadFailed(true);
            setRemoteUrl(null);
          }}
        />
        {isUploading ? (
          <p className="denali-wizard-composite__helper" role="status">
            {t("composites.photos.uploading")}
          </p>
        ) : null}
      </>
    );
  }

  if (!showFallback) {
    return null;
  }

  const fallbackMessage =
    fetchErrorCode !== null
      ? resolveDenaliPhotoUploadError(t, fetchErrorCode) || t("composites.photos.previewLoadFailed")
      : t("composites.photos.previewLoadFailed");

  return (
    <div data-testid={DENALI_PHOTO_PREVIEW_FALLBACK_TEST_ID}>
      <p className="denali-wizard-composite__error" role="alert">
        {fallbackMessage}
      </p>
      {storageKey.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          data-testid={DENALI_PHOTO_PREVIEW_RETRY_TEST_ID}
          onClick={() => {
            setImgLoadFailed(false);
            setFetchErrorCode(null);
            setRetryNonce((value) => value + 1);
          }}
        >
          {t("composites.photos.previewRetry")}
        </Button>
      ) : null}
    </div>
  );
}
