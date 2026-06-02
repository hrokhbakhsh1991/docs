import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestActorRole } from "../auth/user-role.enum";

export interface RequestContext {
  requestId: string;
  /**
   * Cross-boundary correlation id (`x-correlation-id` when trusted clients send it; otherwise same as {@link requestId}).
   * Always set with HTTP via {@link RequestContextMiddleware} and for explicit worker ALS contexts.
   */
  correlationId?: string;
  /**
   * Optional low-cardinality fields merged into structured logs (see `attachCorrelationMetadata` in observability/request-tracing).
   * Do not store secrets, tokens, or medical payloads — opaque ids only.
   */
  attachedLogFields?: Record<string, string>;
  path?: string;
  /** HTTP method for path-scoped checks (e.g. tenant session binding). */
  method?: string;
  /** Tenant UUID from Host (`req.tenant`) before/alongside JWT `tenantId`. */
  hostTenantId?: string;
  /** Once true, tenant context cannot be changed to a different tenant within this request/job. */
  tenantContextFrozen?: boolean;
  /**
   * When true, {@link RequestContextService.setTenantId} may replace a host-frozen tenant
   * with the JWT workspace (workspace session exchange, invite accept by URL token).
   */
  allowJwtTenantOverrideHost?: boolean;
  tenantId?: string;
  userId?: string;
  /** Workspace or synthetic actor role (see {@link RequestActorRole}). */
  role?: RequestActorRole;
  /**
   * Controls tenant binding behavior for DB calls in this async context.
   * `normal`: tenant binding is mandatory before tenant-scoped DB access.
   * `suppressed`: no tenant binding, with strict DB query allow-list only.
   */
  tenantBindingMode?: TenantBindingMode;
  /** Explicit suppression flag; must be true only when mode is `suppressed`. */
  tenantBindingSuppressed?: boolean;
  /** Audit string explaining why `tenantBindingMode` is `suppressed`. */
  tenantBindingSuppressionReason?: string;
  /** Client IP (trust-proxy aware), set by {@link RequestContextMiddleware}. */
  clientIp?: string;
  /**
   * Workspace membership lifecycle for CASL (`user_tenants.membership_status`).
   * Set by {@link AuthMiddleware} after ACTIVE membership is verified for JWT requests.
   */
  workspaceMembershipStatus?: string;
  /** Optional marketing / CRM labels for ability rules (future: load from DB). */
  abilityLabels?: readonly string[];
  /** Optional explicit capability grants from membership row (Phase 5 hydration). */
  workspaceCapabilities?: readonly string[];
  /** Parsed `user_tenants.membership_metadata`. */
  membershipMetadata?: Record<string, unknown>;
  /** Parsed `tenants.enabled_modules` for the active tenant. */
  tenantEnabledModules?: readonly string[];
  /** Optional JWT `caps` claim decoded at auth (informational; ALS/DB hydration is authoritative). */
  jwtCapabilitySnapshot?: readonly string[];
  /** W3C traceparent for distributed tracing. */
  traceparent?: string;
  /** Aggregated DB child span time (ms) from OTEL `pg` instrumentation within this request. */
  dbDurationMs?: number;
  /** Count of DB spans aggregated into {@link dbDurationMs}. */
  dbSpanCount?: number;
}

export enum TenantBindingMode {
  Normal = "normal",
  Suppressed = "suppressed"
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();
