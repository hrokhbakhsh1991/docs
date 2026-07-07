import Image from "next/image";

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
};

export function CatalogCoverImage({
  src,
  alt = "",
  width = 960,
  height = 540,
  cover = false,
  priority = false,
}: CatalogCoverImageProps) {
  const unoptimized = !isMarketingCatalogImageOptimizable(src);

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized={unoptimized}
      priority={priority}
      data-marketing-catalog-cover
      {...(cover ? { "data-marketing-catalog-cover-fill": true } : {})}
    />
  );
}
