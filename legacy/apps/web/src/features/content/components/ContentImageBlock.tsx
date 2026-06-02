import type { ImageBlock } from "@repo/shared-contracts";

import styles from "./PageRenderer.module.css";

export type ContentImageBlockProps = {
  block: ImageBlock;
};

export function ContentImageBlock({ block }: ContentImageBlockProps) {
  return (
    <figure className={styles.imageBlock} data-block-id={block.id} data-block-kind="image">
      {/* eslint-disable-next-line @next/next/no-img-element -- registry URLs are tenant/CMS-driven */}
      <img className={styles.image} src={block.url} alt={block.alt ?? ""} loading="lazy" />
      {block.caption ? <figcaption className={styles.imageCaption}>{block.caption}</figcaption> : null}
    </figure>
  );
}
