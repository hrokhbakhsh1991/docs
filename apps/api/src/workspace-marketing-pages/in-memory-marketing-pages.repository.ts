import type { MarketingHomeHeroPayload } from "@app-tour/marketing-pages-http-contracts";

export type MarketingPageContentRow = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly pageKey: string;
  readonly locale: string;
  readonly draftPayload: MarketingHomeHeroPayload | null;
  readonly publishedPayload: MarketingHomeHeroPayload | null;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
};

type StoreKey = string;

let store = new Map<StoreKey, MarketingPageContentRow>();

function storeKey(
  tenantId: string,
  workspaceId: string,
  pageKey: string,
  locale: string,
): StoreKey {
  return `${tenantId}::${workspaceId}::${pageKey}::${locale}`;
}

export interface MarketingPagesRepository {
  find(
    tenantId: string,
    workspaceId: string,
    pageKey: string,
    locale: string,
  ): Promise<MarketingPageContentRow | null>;
  upsertDraft(
    tenantId: string,
    workspaceId: string,
    pageKey: string,
    locale: string,
    draft: MarketingHomeHeroPayload,
  ): Promise<MarketingPageContentRow>;
  publish(
    tenantId: string,
    workspaceId: string,
    pageKey: string,
    locale: string,
    draft: MarketingHomeHeroPayload,
  ): Promise<MarketingPageContentRow>;
}

export class InMemoryMarketingPagesRepository implements MarketingPagesRepository {
  async find(
    tenantId: string,
    workspaceId: string,
    pageKey: string,
    locale: string,
  ): Promise<MarketingPageContentRow | null> {
    return store.get(storeKey(tenantId, workspaceId, pageKey, locale)) ?? null;
  }

  async upsertDraft(
    tenantId: string,
    workspaceId: string,
    pageKey: string,
    locale: string,
    draft: MarketingHomeHeroPayload,
  ): Promise<MarketingPageContentRow> {
    const key = storeKey(tenantId, workspaceId, pageKey, locale);
    const existing = store.get(key);
    const row: MarketingPageContentRow = {
      tenantId,
      workspaceId,
      pageKey,
      locale,
      draftPayload: draft,
      publishedPayload: existing?.publishedPayload ?? null,
      publishedAt: existing?.publishedAt ?? null,
      updatedAt: new Date(),
    };
    store.set(key, row);
    return row;
  }

  async publish(
    tenantId: string,
    workspaceId: string,
    pageKey: string,
    locale: string,
    draft: MarketingHomeHeroPayload,
  ): Promise<MarketingPageContentRow> {
    const key = storeKey(tenantId, workspaceId, pageKey, locale);
    const publishedAt = new Date();
    const row: MarketingPageContentRow = {
      tenantId,
      workspaceId,
      pageKey,
      locale,
      draftPayload: draft,
      publishedPayload: draft,
      publishedAt,
      updatedAt: publishedAt,
    };
    store.set(key, row);
    return row;
  }
}

export function resetMarketingPagesRepositoryForTests(): void {
  store = new Map();
}
