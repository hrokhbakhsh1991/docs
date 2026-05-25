import type { ReactNode } from "react";

import type { ImageBlock, PageBlock, TextBlock } from "@repo/shared-contracts";

import { ContentImageBlock } from "./ContentImageBlock";
import { ContentTextBlock } from "./ContentTextBlock";

type BlockRenderer = (block: PageBlock) => ReactNode;

export const PAGE_BLOCK_RENDERERS: Record<PageBlock["kind"], BlockRenderer> = {
  text: (block) => <ContentTextBlock block={block as TextBlock} />,
  image: (block) => <ContentImageBlock block={block as ImageBlock} />,
};

/**
 * ComponentFactory entry — maps {@link PageBlockSchema} `kind` to a React block component.
 */
export function renderPageBlock(block: PageBlock): ReactNode {
  const render = PAGE_BLOCK_RENDERERS[block.kind];
  if (!render) {
    return null;
  }
  return render(block);
}
