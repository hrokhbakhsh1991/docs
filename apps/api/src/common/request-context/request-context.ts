import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestActorRole } from "../auth/user-role.enum";

export interface RequestContext {
  requestId: string;
  path?: string;
  /** HTTP method for path-scoped checks (e.g. tenant session binding). */
  method?: string;
  /** Tenant UUID from Host (`req.tenant`) before/alongside JWT `tenantId`. */
  hostTenantId?: string;
  /** Once true, tenant context cannot be changed to a different tenant within this request/job. */
  tenantContextFrozen?: boolean;
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
}

export enum TenantBindingMode {
  Normal = "normal",
  Suppressed = "suppressed"
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();
