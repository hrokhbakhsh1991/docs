import type { MarketingHomeHeroPayload } from "@app-tour/marketing-pages-http-contracts";

import { withTenantRls } from "../db/with-tenant-rls";
import type {
  MarketingPageContentRow,
  MarketingPagesRepository,
} from "./in-memory-marketing-pages.repository";

function mapRow(row: {
  tenantId: string;
  workspaceId: string;
  pageKey: string;
  locale: string;
  draftPayload: unknown;
  publishedPayload: unknown | null;
  publishedAt: Date | null;
  updatedAt: Date;
}): MarketingPageContentRow {
  return {
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    pageKey: row.pageKey,
    locale: row.locale,
    draftPayload: row.draftPayload as MarketingHomeHeroPayload,
    publishedPayload: row.publishedPayload as MarketingHomeHeroPayload | null,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaMarketingPagesRepository implements MarketingPagesRepository {
  async find(
    tenantId: string,
    workspaceId: string,
    pageKey: string,
    locale: string,
  ): Promise<MarketingPageContentRow | null> {
    const row = await withTenantRls(tenantId, async (tx) =>
      tx.marketingPageContent.findUnique({
        where: {
          tenantId_workspaceId_pageKey_locale: {
            tenantId,
            workspaceId,
            pageKey,
            locale,
          },
        },
      }),
    );
    return row === null ? null : mapRow(row);
  }

  async upsertDraft(
    tenantId: string,
    workspaceId: string,
    pageKey: string,
    locale: string,
    draft: MarketingHomeHeroPayload,
  ): Promise<MarketingPageContentRow> {
    const row = await withTenantRls(tenantId, async (tx) =>
      tx.marketingPageContent.upsert({
        where: {
          tenantId_workspaceId_pageKey_locale: {
            tenantId,
            workspaceId,
            pageKey,
            locale,
          },
        },
        create: {
          tenantId,
          workspaceId,
          pageKey,
          locale,
          draftPayload: draft,
        },
        update: {
          draftPayload: draft,
        },
      }),
    );
    return mapRow(row);
  }

  async publish(
    tenantId: string,
    workspaceId: string,
    pageKey: string,
    locale: string,
    draft: MarketingHomeHeroPayload,
  ): Promise<MarketingPageContentRow> {
    const publishedAt = new Date();
    const row = await withTenantRls(tenantId, async (tx) =>
      tx.marketingPageContent.upsert({
        where: {
          tenantId_workspaceId_pageKey_locale: {
            tenantId,
            workspaceId,
            pageKey,
            locale,
          },
        },
        create: {
          tenantId,
          workspaceId,
          pageKey,
          locale,
          draftPayload: draft,
          publishedPayload: draft,
          publishedAt,
        },
        update: {
          draftPayload: draft,
          publishedPayload: draft,
          publishedAt,
        },
      }),
    );
    return mapRow(row);
  }
}
