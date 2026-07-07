"use client";

import { useCallback, useEffect, useState } from "react";
import { isDenaliHttpsImageUrl } from "../../schemas/denaliFileAssetSchema";
import { useTranslations } from "next-intl";

import { resolveDenaliPhotoUploadError } from "../adapters/photo-upload-errors";
import { Button } from "../adapters/platform-primitives";
import { resolveDenaliWizardPhotoPreviewUrl } from "../adapters/photo-upload-client";
import type { DenaliTourPhoto } from "../logic/denali-photo-types";
import {
  DENALI_PHOTO_PREVIEW_FALLBACK_TEST_ID,
  DENALI_PHOTO_PREVIEW_RETRY_TEST_ID,
  DENALI_PHOTO_PREVIEW_TEST_ID,
} from "../test-ids/denali-photos-test-ids";

export {
  DENALI_PHOTO_PREVIEW_FALLBACK_TEST_ID,
  DENALI_PHOTO_PREVIEW_RETRY_TEST_ID,
  DENALI_PHOTO_PREVIEW_TEST_ID,
} from "../test-ids/denali-photos-test-ids";

type DenaliPhotoPreviewProps = {
  readonly photo: DenaliTourPhoto;
  readonly altFallback: string;
  readonly className?: string;
  readonly testId?: string;
  readonly localPreviewUrl?: string | null;
  readonly isUploading?: boolean;
  /** Review/read-back: no retry control; compact fallback copy only. */
  readonly readOnly?: boolean;
};

export function DenaliPhotoPreview({
  photo,
  altFallback,
  className = "denali-wizard-composite__preview-img",
  testId = DENALI_PHOTO_PREVIEW_TEST_ID,
  localPreviewUrl = null,
  isUploading = false,
  readOnly = false,
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
    <div
      data-testid={DENALI_PHOTO_PREVIEW_FALLBACK_TEST_ID}
      className={readOnly ? "denali-review__photo-fallback" : undefined}
    >
      <p
        className={readOnly ? "denali-review__photo-fallback-text" : "denali-wizard-composite__error"}
        role="alert"
      >
        {fallbackMessage}
      </p>
      {!readOnly && storageKey.length > 0 ? (
        <Button
          type="button"
          variant="secondary"
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
