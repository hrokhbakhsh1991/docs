"use client";

import { Mountain } from "lucide-react";
import { useEffect, useState } from "react";

import { resolveTourListCoverImageUrl } from "@/features/tours/resolve-tour-list-cover-url";

type TourListCoverImageProps = {
  readonly coverImageUrl: string | null;
  readonly coverImageStorageKey: string | null;
  readonly noCoverLabel: string;
  readonly testId?: string;
};

export function TourListCoverImage({
  coverImageUrl,
  coverImageStorageKey,
  noCoverLabel,
  testId,
}: TourListCoverImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(coverImageUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setResolvedUrl(coverImageUrl);
    setFailed(false);
  }, [coverImageUrl, coverImageStorageKey]);

  useEffect(() => {
    if (coverImageUrl !== null && coverImageUrl.trim().length > 0) {
      return;
    }
    const storageKey = coverImageStorageKey?.trim() ?? "";
    if (storageKey.length === 0) {
      return;
    }

    let cancelled = false;
    void resolveTourListCoverImageUrl(storageKey).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setResolvedUrl(result.url);
        setFailed(false);
        return;
      }
      setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [coverImageStorageKey, coverImageUrl]);

  if (resolvedUrl) {
    return (
      <div className="aspect-[16/9] w-full overflow-hidden bg-muted" data-testid={testId}>
        <img
          src={resolvedUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => {
            setResolvedUrl(null);
            setFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex aspect-[16/9] w-full items-center justify-center bg-muted"
      aria-label={failed ? `${noCoverLabel} (load failed)` : noCoverLabel}
      data-testid={testId}
    >
      <Mountain className="size-8 text-muted-foreground/45" aria-hidden />
    </div>
  );
}
