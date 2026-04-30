import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  path?: string;
  tenantId?: string;
  userId?: string;
  role?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();
