import {
  MARKETING_PAGE_KEY_HOME_HERO,
  parseMarketingHomeHeroPayload,
  parseMarketingPageLocale,
  type MarketingHomeHeroPayload,
  type MarketingPageLocale,
} from "@app-tour/marketing-pages-http-contracts";

import { getMarketingPagesRepository } from "./create-marketing-pages-repository";
import {
  assertMarketingPageKeyAllowed,
  assertMarketingPagesWorkspaceGate,
} from "./marketing-pages-module-enabled";
import { resolveMarketingPagesAllowedKeys } from "./workspace-marketing-pages-bindings.generated.ts";

export type MarketingPageOperatorView = {
  readonly pageKey: string;
  readonly locale: MarketingPageLocale;
  readonly draft: MarketingHomeHeroPayload | null;
  readonly published: MarketingHomeHeroPayload | null;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
};

export type MarketingPagePublicView = {
  readonly pageKey: string;
  readonly locale: MarketingPageLocale;
  readonly published: MarketingHomeHeroPayload;
};

function parseHomeHeroPayloadOrNull(payload: unknown): MarketingHomeHeroPayload | null {
  if (payload === null || payload === undefined) {
    return null;
  }
  try {
    return parseMarketingHomeHeroPayload(payload);
  } catch {
    return null;
  }
}

function assertHomeHeroPageKey(pageKey: string): void {
  if (pageKey !== MARKETING_PAGE_KEY_HOME_HERO) {
    throw new Error("MARKETING_PAGE_KEY_NOT_ALLOWED");
  }
}

function isMarketingPagesModuleEnabledForPublic(workspaceType: string): boolean {
  return resolveMarketingPagesAllowedKeys(workspaceType).length > 0;
}

export class MarketingPagesService {
  async getOperatorPage(
    tenantId: string,
    pageKey: string,
    localeInput: string | null | undefined,
  ): Promise<MarketingPageOperatorView> {
    const gate = await assertMarketingPagesWorkspaceGate(tenantId);
    assertMarketingPageKeyAllowed(gate.workspaceType, pageKey);
    assertHomeHeroPageKey(pageKey);
    const locale = parseMarketingPageLocale(localeInput);
    const repository = getMarketingPagesRepository();
    const row = await repository.find(tenantId, gate.workspaceType, pageKey, locale);
    const now = new Date();

    if (row === null) {
      return {
        pageKey,
        locale,
        draft: null,
        published: null,
        publishedAt: null,
        updatedAt: now.toISOString(),
      };
    }

    return {
      pageKey,
      locale,
      draft: parseHomeHeroPayloadOrNull(row.draftPayload),
      published: parseHomeHeroPayloadOrNull(row.publishedPayload),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async saveDraft(
    tenantId: string,
    pageKey: string,
    localeInput: string | null | undefined,
    body: unknown,
  ): Promise<MarketingPageOperatorView> {
    const gate = await assertMarketingPagesWorkspaceGate(tenantId);
    assertMarketingPageKeyAllowed(gate.workspaceType, pageKey);
    assertHomeHeroPageKey(pageKey);
    const locale = parseMarketingPageLocale(localeInput);
    const draft = parseMarketingHomeHeroPayload(body);
    const repository = getMarketingPagesRepository();
    await repository.upsertDraft(tenantId, gate.workspaceType, pageKey, locale, draft);
    return this.getOperatorPage(tenantId, pageKey, locale);
  }

  async publish(
    tenantId: string,
    pageKey: string,
    localeInput: string | null | undefined,
  ): Promise<MarketingPageOperatorView> {
    const gate = await assertMarketingPagesWorkspaceGate(tenantId);
    assertMarketingPageKeyAllowed(gate.workspaceType, pageKey);
    assertHomeHeroPageKey(pageKey);
    const locale = parseMarketingPageLocale(localeInput);
    const repository = getMarketingPagesRepository();
    const existing = await repository.find(tenantId, gate.workspaceType, pageKey, locale);
    const draftPayload = parseHomeHeroPayloadOrNull(existing?.draftPayload);
    if (draftPayload === null) {
      throw new Error("MARKETING_PAGE_DRAFT_REQUIRED");
    }
    await repository.publish(tenantId, gate.workspaceType, pageKey, locale, draftPayload);
    return this.getOperatorPage(tenantId, pageKey, locale);
  }

  async getPublishedPublicPage(
    tenantId: string,
    workspaceType: string,
    pageKey: string,
    localeInput: string | null | undefined,
  ): Promise<MarketingPagePublicView | null> {
    const normalizedWorkspace = workspaceType.trim().toLowerCase();
    if (!isMarketingPagesModuleEnabledForPublic(normalizedWorkspace)) {
      return null;
    }
    assertMarketingPageKeyAllowed(normalizedWorkspace, pageKey);
    assertHomeHeroPageKey(pageKey);
    const locale = parseMarketingPageLocale(localeInput);
    const repository = getMarketingPagesRepository();
    const row = await repository.find(tenantId, normalizedWorkspace, pageKey, locale);
    const published = parseHomeHeroPayloadOrNull(row?.publishedPayload);
    if (published === null) {
      return null;
    }
    return { pageKey, locale, published };
  }
}

let singleton: MarketingPagesService | null = null;

export function getMarketingPagesService(): MarketingPagesService {
  singleton ??= new MarketingPagesService();
  return singleton;
}

export function resetMarketingPagesServiceForTests(): void {
  singleton = null;
}
