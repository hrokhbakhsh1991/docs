export type WorkspaceHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Declarative wallet HTTP inventory — host codegen / manifest registration. */
export const WALLET_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/wallet/accounts/:accountId/balance" },
  { method: "GET", path: "/wallet/accounts/:accountId/transactions" },
  { method: "GET", path: "/wallet/accounts" },
  { method: "POST", path: "/wallet/accounts/:accountId/credit" },
  { method: "POST", path: "/wallet/accounts/:accountId/debit" },
  { method: "POST", path: "/wallet/transactions/:transactionId/reverse" },
] as const;
