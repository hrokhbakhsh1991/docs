import type { IncomingMessage, ServerResponse } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type {
  EngagementMemberLookupHttpResponse,
  EngagementMemberSummaryHttpResponse,
  EngagementOperatorOverviewHttpResponse,
  EngagementOperatorPolicyHttpResponse,
  EngagementAdjustmentHttpResponse,
  EngagementPointHistoryHttpResponse,
  EngagementReversalHttpResponse,
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
