import type { IncomingMessage, ServerResponse } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type {
  CreateAwardRuleBody,
  CreateBadgeBody,
  CreateLevelBody,
  EngagementAdjustmentHttpResponse,
  EngagementAwardRuleDefinitionHttpItem,
  EngagementAwardRuleDefinitionListHttpResponse,
  EngagementBadgeDefinitionHttpItem,
  EngagementBadgeDefinitionListHttpResponse,
  EngagementDefinitionAuditListHttpResponse,
  EngagementLevelDefinitionHttpItem,
  EngagementLevelDefinitionListHttpResponse,
  EngagementMemberLookupHttpResponse,
  EngagementMemberSummaryHttpResponse,
  EngagementOperatorCatalogHttpResponse,
  EngagementOperatorOverviewHttpResponse,
  EngagementOperatorPolicyHttpResponse,
  EngagementPointHistoryHttpResponse,
  EngagementReversalHttpResponse,
  UpdateAwardRuleBody,
  UpdateBadgeBody,
  UpdateLevelBody,
} from "@app-tour/engagement-http-contracts";

export type EngagementServicePort = {
  getMemberSummary(auth: TenantAuthContext): Promise<EngagementMemberSummaryHttpResponse>;
  getMemberPointHistory(
    auth: TenantAuthContext,
    query: { readonly limit: number; readonly cursor?: string },
  ): Promise<EngagementPointHistoryHttpResponse>;
  getMemberBadges(auth: TenantAuthContext): Promise<EngagementMemberSummaryHttpResponse["badges"]>;
  getOperatorOverview(auth: TenantAuthContext): Promise<EngagementOperatorOverviewHttpResponse>;
  getOperatorPolicy(auth: TenantAuthContext): Promise<EngagementOperatorPolicyHttpResponse>;
  getOperatorMemberLookup(
    auth: TenantAuthContext,
    userId: string,
  ): Promise<EngagementMemberLookupHttpResponse>;
  adjustMemberPoints(
    auth: TenantAuthContext,
    userId: string,
    input: {
      readonly pointsDelta: number;
      readonly reason: string;
      readonly idempotencyKey: string;
      readonly sourceEntityId?: string;
    },
  ): Promise<EngagementAdjustmentHttpResponse>;
  reversePointEvent(
    auth: TenantAuthContext,
    userId: string,
    input: { readonly originalEventId: string; readonly reason: string; readonly idempotencyKey: string },
  ): Promise<EngagementReversalHttpResponse>;
  listOperatorBadges(auth: TenantAuthContext): Promise<EngagementBadgeDefinitionListHttpResponse>;
  createOperatorBadge(
    auth: TenantAuthContext,
    input: CreateBadgeBody & { readonly idempotencyKey: string },
  ): Promise<EngagementBadgeDefinitionHttpItem>;
  updateOperatorBadge(
    auth: TenantAuthContext,
    code: string,
    input: UpdateBadgeBody,
  ): Promise<EngagementBadgeDefinitionHttpItem>;
  listOperatorLevels(auth: TenantAuthContext): Promise<EngagementLevelDefinitionListHttpResponse>;
  createOperatorLevel(
    auth: TenantAuthContext,
    input: CreateLevelBody & { readonly idempotencyKey: string },
  ): Promise<EngagementLevelDefinitionHttpItem>;
  updateOperatorLevel(
    auth: TenantAuthContext,
    code: string,
    input: UpdateLevelBody,
  ): Promise<EngagementLevelDefinitionHttpItem>;
  listOperatorAwardRules(
    auth: TenantAuthContext,
  ): Promise<EngagementAwardRuleDefinitionListHttpResponse>;
  createOperatorAwardRule(
    auth: TenantAuthContext,
    input: CreateAwardRuleBody & { readonly idempotencyKey: string },
  ): Promise<EngagementAwardRuleDefinitionHttpItem>;
  updateOperatorAwardRule(
    auth: TenantAuthContext,
    ruleId: string,
    input: UpdateAwardRuleBody,
  ): Promise<EngagementAwardRuleDefinitionHttpItem>;
  listOperatorAuditLog(
    auth: TenantAuthContext,
    query: { readonly limit: number },
  ): Promise<EngagementDefinitionAuditListHttpResponse>;
  getOperatorCatalog(auth: TenantAuthContext): Promise<EngagementOperatorCatalogHttpResponse>;
};

export type EngagementRouteDeps = {
  readonly engagementService?: EngagementServicePort;
};

export type EngagementHttpHostPorts = {
  readonly runWithHttpRequestContext: <T>(
    req: IncomingMessage,
    auth: TenantAuthContext,
    fn: () => Promise<T>,
    options?: { readonly rateLimit?: "read" | "write" },
  ) => Promise<T>;
  readonly sendJson: (res: ServerResponse, status: number, body: unknown) => void;
  readonly handleHttpError: (res: ServerResponse, error: unknown) => void;
  readonly resolveTenantContextFromRequest: (req: IncomingMessage) => Promise<TenantAuthContext>;
  readonly readEngagementRequestBody: (
    req: IncomingMessage,
  ) => Promise<{ readonly parsedBody: unknown; readonly rawBody: string }>;
  readonly resolveEngagementService: (
    deps: EngagementRouteDeps,
    auth: TenantAuthContext,
  ) => Promise<EngagementServicePort>;
  readonly readIdempotencyKey: (req: IncomingMessage) => string | undefined;
  readonly hashIdempotentRequest: (method: string, path: string, rawBody: string) => string;
  readonly runIdempotentHttpMutation: <T extends Record<string, unknown>>(
    tenantId: string,
    idempotencyKey: string,
    requestHash: string,
    execute: () => Promise<T>,
    options?: { readonly statusCode?: number },
  ) => Promise<T>;
  readonly idempotencyKeyRequiredCode: string;
};
