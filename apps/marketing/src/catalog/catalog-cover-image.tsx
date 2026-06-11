import Image from "next/image";

import { isMarketingCatalogImageOptimizable } from "./resolve-marketing-image-hosts";

export type CatalogCoverImageProps = {
  readonly src: string;
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
};

export function CatalogCoverImage({
  src,
  alt = "",
  width = 960,
  height = 540,
}: CatalogCoverImageProps) {
  const unoptimized = !isMarketingCatalogImageOptimizable(src);

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized={unoptimized}
      data-marketing-catalog-cover
      style={{ maxWidth: "100%", height: "auto", borderRadius: "0.5rem" }}
    />
  );
}
