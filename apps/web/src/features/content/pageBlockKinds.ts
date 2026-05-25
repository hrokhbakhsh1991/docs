import type { PageBlock } from "@repo/shared-contracts";

/** Block kinds implemented by the web ComponentFactory (parity with {@link PageBlockSchema}). */
export const SUPPORTED_PAGE_BLOCK_KINDS = ["text", "image"] as const satisfies readonly PageBlock["kind"][];
