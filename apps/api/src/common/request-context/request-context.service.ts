import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import { TenantContextMissingError } from "../errors/tenant-context-missing.error";
import { assertTenantContext } from "./assert-tenant-context";
import {
  type RequestContext,
  TenantBindingMode,
  requestContextStorage
} from "./request-context";

/** Snake_case bindings merged into every Pino log line when ALS store exists. */
export type StructuredLogContext = Record<string, string>;
export type ResolvedTenantContext = {
  tenantId: string | undefined;
  source: "host" | "jwt" | "system" | undefined;
};

@Injectable()
export class RequestContextService {
  private normalizeTenantId(id: string): string {
    return id.trim().toLowerCase();
  }

  private freezeTenantContext(context: RequestContext): void {
    context.tenantContextFrozen = true;
  }

  private assertTenantContextMutationAllowed(
    context: RequestContext,
    incomingTenantId: string
  ): void {
    const next = this.normalizeTenantId(incomingTenantId);
    const current = context.tenantId ? this.normalizeTenantId(context.tenantId) : undefined;
    const hostCurrent = context.hostTenantId
      ? this.normalizeTenantId(context.hostTenantId)
      : undefined;

    if (context.tenantContextFrozen && current && current !== next) {
      throw new Error("TENANT_CONTEXT_INVALID");
    }
    if (hostCurrent && hostCurrent !== next) {
      throw new Error("TENANT_CONTEXT_INVALID");
    }
  }

  getContext(): RequestContext {
    const context = requestContextStorage.getStore();
    if (!context) {
      throw new TenantContextMissingError("Request context is not available");
    }
    return context;
  }

  assertTenantContext(): RequestContext & { tenantId: string } {
    return assertTenantContext();
  }

  /**
   * Safe for logging outside HTTP requests (returns null when ALS has no store).
   * Uses snake_case keys (`tenant_id`, `request_id`, `route`, …) for log processors / OTLP.
   */
  /** Safe tenant UUID from JWT (`tenantId`) when ALS exists and value set. */
  tryGetTenantId(): string | undefined {
    const store = requestContextStorage.getStore();
    const v = store?.tenantId?.trim();
    return v && v !== "" ? v.toLowerCase() : undefined;
  }

  /** Host-resolved tenant UUID before/alongside JWT (see {@link setHostTenantId}). */
  tryGetHostTenantId(): string | undefined {
    const store = requestContextStorage.getStore();
    const v = store?.hostTenantId?.trim();
    return v && v !== "" ? v.toLowerCase() : undefined;
  }

  tryGetUserId(): string | undefined {
    const store = requestContextStorage.getStore();
    const v = store?.userId?.trim();
    return v && v !== "" ? v : undefined;
  }

  tryGetRequestId(): string | undefined {
    const store = requestContextStorage.getStore();
    const v = store?.requestId?.trim();
    return v && v !== "" ? v : undefined;
  }

  tryGetClientIp(): string | undefined {
    const store = requestContextStorage.getStore();
    const v = store?.clientIp?.trim();
    return v && v !== "" ? v : undefined;
  }

  tryGetStructuredLogContext(): StructuredLogContext | null {
    const store = requestContextStorage.getStore();
    if (!store) {
      return null;
    }
    const fields: StructuredLogContext = { request_id: store.requestId };
    if (store.path !== undefined && store.path !== "") {
      fields.route = store.path;
    }
    if (store.method !== undefined && store.method !== "") {
      fields.method = store.method;
    }
    const tenantForLog = store.tenantId ?? store.hostTenantId;
    if (tenantForLog !== undefined && tenantForLog !== "") {
      fields.tenant_id = tenantForLog;
    }
    if (store.userId !== undefined && store.userId !== "") {
      fields.user_id = store.userId;
    }
    if (store.role !== undefined && store.role !== "") {
      fields.role = store.role;
    }
    const ip = store.clientIp?.trim();
    if (ip !== undefined && ip !== "") {
      fields.client_ip = ip;
    }
    return fields;
  }

  /** Attach Host-resolved tenant UUID for logging before JWT fills `tenantId`. */
  setHostTenantId(id: string): void {
    const store = requestContextStorage.getStore();
    if (store) {
      const next = this.normalizeTenantId(id);
      this.assertTenantContextMutationAllowed(store, next);
      store.hostTenantId = next;
      if (!store.tenantId) {
        store.tenantId = next;
      }
      this.freezeTenantContext(store);
    }
  }

  getRequestId(): string {
    return this.getContext().requestId;
  }

  getTenantId(): string | undefined {
    return this.getContext().tenantId;
  }

  getUserId(): string | undefined {
    return this.getContext().userId;
  }

  getRole(): string | undefined {
    return this.getContext().role;
  }

  setTenantId(id: string): void {
    const context = this.getContext();
    const next = this.normalizeTenantId(id);
    this.assertTenantContextMutationAllowed(context, next);
    context.tenantId = next;
    this.freezeTenantContext(context);
  }

  setUserId(id: string): void {
    const context = this.getContext();
    context.userId = id;
  }

  setRole(role: string): void {
    const context = this.getContext();
    context.role = role;
  }

  /**
   * Canonical tenant resolution for middleware/services:
   * 1) JWT tenant from ALS context
   * 2) host-resolved tenant attached to request
   * 3) host tenant from ALS context
   */
  resolveTenantContext(req?: Request): ResolvedTenantContext {
    const store = requestContextStorage.getStore();
    const storeTenant = store?.tenantId?.trim();
    const storeHostTenant = store?.hostTenantId?.trim();

    if (storeTenant && storeTenant !== "") {
      const source = store?.userId?.trim() ? "jwt" : "system";
      return { tenantId: storeTenant.toLowerCase(), source };
    }

    const host = req?.tenant?.id;
    if (typeof host === "string" && host.trim() !== "") {
      return { tenantId: host.trim().toLowerCase(), source: "host" };
    }

    if (storeHostTenant && storeHostTenant !== "") {
      return { tenantId: storeHostTenant.toLowerCase(), source: "host" };
    }

    return { tenantId: undefined, source: undefined };
  }

  resolveEffectiveTenantId(req?: Request): string | undefined {
    return this.resolveTenantContext(req).tenantId;
  }

  /**
   * Runs `fn` in explicit tenant-binding-suppressed mode.
   * Suppressed mode is only for narrowly whitelisted pre-tenant bootstrap queries.
   */
  async runWithoutTenantBinding<T>(reason: string, fn: () => Promise<T>): Promise<T> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error("TENANT_BINDING_SUPPRESSION_REASON_REQUIRED");
    }
    const context = this.getContext();
    const prevMode = context.tenantBindingMode;
    const prevSuppressed = context.tenantBindingSuppressed;
    const prevReason = context.tenantBindingSuppressionReason;
    context.tenantBindingMode = TenantBindingMode.Suppressed;
    context.tenantBindingSuppressed = true;
    context.tenantBindingSuppressionReason = trimmedReason;
    try {
      return await fn();
    } finally {
      context.tenantBindingMode = prevMode;
      context.tenantBindingSuppressed = prevSuppressed;
      context.tenantBindingSuppressionReason = prevReason;
    }
  }
}
