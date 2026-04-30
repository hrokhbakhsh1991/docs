import { Injectable } from "@nestjs/common";
import {
  type RequestContext,
  requestContextStorage
} from "./request-context";

export type LogContextFields = {
  requestId: string;
  tenantId?: string;
  userId?: string;
  role?: string;
};

@Injectable()
export class RequestContextService {
  getContext(): RequestContext {
    const context = requestContextStorage.getStore();
    if (!context) {
      throw new Error("Request context is not available");
    }
    return context;
  }

  /**
   * Safe for logging outside HTTP requests (returns null when ALS has no store).
   */
  tryGetLogAttributes(): LogContextFields | null {
    const store = requestContextStorage.getStore();
    if (!store) {
      return null;
    }
    const fields: LogContextFields = { requestId: store.requestId };
    if (store.tenantId !== undefined) {
      fields.tenantId = store.tenantId;
    }
    if (store.userId !== undefined) {
      fields.userId = store.userId;
    }
    if (store.role !== undefined) {
      fields.role = store.role;
    }
    return fields;
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
    context.tenantId = id;
  }

  setUserId(id: string): void {
    const context = this.getContext();
    context.userId = id;
  }

  setRole(role: string): void {
    const context = this.getContext();
    context.role = role;
  }
}
