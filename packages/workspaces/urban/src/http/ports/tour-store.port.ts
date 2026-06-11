export type UrbanTourCanonical = {
  readonly data: Record<string, unknown>;
};

export type UrbanTourRecord = {
  readonly id: string;
  readonly createdAt: string;
  readonly canonical: UrbanTourCanonical;
};

export type UrbanTourListPageResult = {
  readonly items: readonly UrbanTourRecord[];
};

/** Host-injected tour read port — Prisma adapter lives in apps/api. */
export interface UrbanTourStorePort {
  listPage(
    where: { readonly tenantId: string },
    page: { readonly limit: number }
  ): Promise<UrbanTourListPageResult>;
  findFirst(where: {
    readonly tenantId: string;
    readonly id: string;
  }): Promise<UrbanTourRecord | null>;
}
