import type { CanonicalDocument } from "@app-tour/workspace-sdk";

export type DenaliTourRecord = {
  readonly id: string;
  readonly createdAt: string;
  readonly canonical: CanonicalDocument;
};

export type DenaliTourListPageResult = {
  readonly items: readonly DenaliTourRecord[];
};

/** Host-injected tour read port — Prisma adapter lives in apps/api. */
export interface DenaliTourStorePort {
  listPage(
    where: { readonly tenantId: string },
    page: { readonly limit: number }
  ): Promise<DenaliTourListPageResult>;
  findFirst(where: {
    readonly tenantId: string;
    readonly id: string;
  }): Promise<DenaliTourRecord | null>;
}
