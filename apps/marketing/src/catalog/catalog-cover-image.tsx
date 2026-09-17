"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { isMarketingCatalogImageOptimizable } from "./resolve-marketing-image-hosts";

export type CatalogCoverImageProps = {
  readonly src: string;
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
  /** Fill parent box (16:9 cover figures on home latest cards). */
  readonly cover?: boolean;
  /** LCP hint — only first above-the-fold hero/featured card (PR-9). */
  readonly priority?: boolean;
  /** Render width hint for responsive card layouts. */
  readonly sizes?: string;
  /** Optional smaller fallback for dense card surfaces; detail views keep the default. */
  readonly fallbackSrc?: string;
};

const DEFAULT_CATALOG_COVER_FALLBACK = "/home/fallback-tour-cover.webp";

export function CatalogCoverImage({
  src,
  alt = "",
  width = 960,
  height = 540,
  cover = false,
  priority = false,
  sizes,
  fallbackSrc,
}: CatalogCoverImageProps) {
  const normalizedFallbackSrc = fallbackSrc?.trim() || DEFAULT_CATALOG_COVER_FALLBACK;
  const requestedSrc = src.trim();
  const normalizedSrc =
    requestedSrc.length > 0 && requestedSrc !== DEFAULT_CATALOG_COVER_FALLBACK
      ? requestedSrc
      : normalizedFallbackSrc;
  const [imageSrc, setImageSrc] = useState(normalizedSrc);

  useEffect(() => {
    setImageSrc(normalizedSrc);
  }, [normalizedSrc]);

  const isFallback = imageSrc === normalizedFallbackSrc;
  const unoptimized = !isMarketingCatalogImageOptimizable(imageSrc);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      unoptimized={unoptimized}
      priority={priority}
      sizes={sizes}
      data-marketing-catalog-cover
      onError={() => {
        if (!isFallback) {
          setImageSrc(normalizedFallbackSrc);
        }
      }}
      {...(cover ? { "data-marketing-catalog-cover-fill": true } : {})}
      {...(isFallback ? { "data-marketing-catalog-cover-fallback": true } : {})}
    />
  );
}
