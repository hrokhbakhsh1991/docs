import type { TextBlock } from "@repo/shared-contracts";

import styles from "./PageRenderer.module.css";

export type ContentTextBlockProps = {
  block: TextBlock;
};

export function ContentTextBlock({ block }: ContentTextBlockProps) {
  return (
    <div className={styles.textBlock} data-block-id={block.id} data-block-kind="text">
      {block.heading ? <h3 className={styles.textHeading}>{block.heading}</h3> : null}
      <p className={styles.textBody}>{block.body}</p>
    </div>
  );
}
