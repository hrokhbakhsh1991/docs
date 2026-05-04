import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  path?: string;
  /** HTTP method for path-scoped checks (e.g. tenant session binding). */
  method?: string;
  tenantId?: string;
  userId?: string;
  role?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();
