/**
 * Wallet-owned HTTP handlers (Phase 2D).
 * Generic handlers; workspace route registration via manifest codegen.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  parseOperatorAccountLookupUserId,
  parseOperatorCreditBody,
  parseOperatorDebitBody,
  parseOperatorReversalBody,
  parseOptionalCurrencyFilter,
  parseOptionalListCursor,
  parseOptionalWorkspaceFilter,
  parseWalletTransactionsLimit,
} from "@app-tour/wallet-http-contracts";

import { getWalletHttpHost } from "./host-runtime";
import type { WalletRouteDeps } from "./host-ports";

export type { WalletRouteDeps } from "./host-ports";

export async function handleWalletMemberOwnBalance(
  req: IncomingMessage,
  res: ServerResponse,
  deps: WalletRouteDeps,
): Promise<void> {
  const host = getWalletHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const walletService = await host.resolveWalletService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const summary = await walletService.getMemberOwnBalance(auth);
        host.sendJson(res, 200, summary);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleWalletMemberOwnTransactions(
  req: IncomingMessage,
  res: ServerResponse,
  deps: WalletRouteDeps,
): Promise<void> {
  const host = getWalletHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseWalletTransactionsLimit(url.searchParams.get("limit"));
    const cursor = parseOptionalListCursor(url.searchParams.get("cursor"));
    const walletService = await host.resolveWalletService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const page = await walletService.getMemberOwnTransactions(auth, {
          limit,
          ...(cursor !== undefined ? { cursor } : {}),
        });
        host.sendJson(res, 200, page);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleWalletMemberBalance(
  req: IncomingMessage,
  res: ServerResponse,
  deps: WalletRouteDeps,
  accountId: string,
): Promise<void> {
  const host = getWalletHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const walletService = await host.resolveWalletService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const balance = await walletService.getMemberBalance(auth, accountId);
        host.sendJson(res, 200, balance);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleWalletMemberTransactions(
  req: IncomingMessage,
  res: ServerResponse,
  deps: WalletRouteDeps,
  accountId: string,
): Promise<void> {
  const host = getWalletHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseWalletTransactionsLimit(url.searchParams.get("limit"));
    const cursor = parseOptionalListCursor(url.searchParams.get("cursor"));
    const walletService = await host.resolveWalletService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const page = await walletService.getMemberTransactions(auth, accountId, {
          limit,
          ...(cursor !== undefined ? { cursor } : {}),
        });
        host.sendJson(res, 200, page);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleWalletOperatorAccounts(
  req: IncomingMessage,
  res: ServerResponse,
  deps: WalletRouteDeps,
): Promise<void> {
  const host = getWalletHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const userId = parseOperatorAccountLookupUserId(url.searchParams.get("userId"));
    const currency = parseOptionalCurrencyFilter(url.searchParams.get("currency"));
    const workspaceId = parseOptionalWorkspaceFilter(url.searchParams.get("workspaceId"));
    const walletService = await host.resolveWalletService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await walletService.lookupOperatorAccounts(auth, {
          userId,
          ...(currency !== undefined ? { currency } : {}),
          ...(workspaceId !== undefined ? { workspaceId } : {}),
        });
        host.sendJson(res, 200, result);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleWalletOperatorCredit(
  req: IncomingMessage,
  res: ServerResponse,
  deps: WalletRouteDeps,
  accountId: string,
): Promise<void> {
  const host = getWalletHttpHost();
  try {
    const idempotencyKey = host.readIdempotencyKey(req);
    if (idempotencyKey === undefined) {
      throw new Error(host.idempotencyKeyRequiredCode);
    }
    const { parsedBody, rawBody } = await host.readWalletRequestBody(req);
    const body = parseOperatorCreditBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const walletService = await host.resolveWalletService(deps, auth);
    const requestHash = host.hashIdempotentRequest(
      req.method ?? "POST",
      `/wallet/accounts/${accountId}/credit`,
      rawBody,
    );
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const created = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => {
            const result = await walletService.operatorCredit(
              auth,
              accountId,
              body,
              idempotencyKey,
            );
            return result as Record<string, unknown>;
          },
          { statusCode: 201 },
        );
        host.sendJson(res, 201, created);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleWalletOperatorDebit(
  req: IncomingMessage,
  res: ServerResponse,
  deps: WalletRouteDeps,
  accountId: string,
): Promise<void> {
  const host = getWalletHttpHost();
  try {
    const idempotencyKey = host.readIdempotencyKey(req);
    if (idempotencyKey === undefined) {
      throw new Error(host.idempotencyKeyRequiredCode);
    }
    const { parsedBody, rawBody } = await host.readWalletRequestBody(req);
    const body = parseOperatorDebitBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const walletService = await host.resolveWalletService(deps, auth);
    const requestHash = host.hashIdempotentRequest(
      req.method ?? "POST",
      `/wallet/accounts/${accountId}/debit`,
      rawBody,
    );
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const created = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => {
            const result = await walletService.operatorDebit(
              auth,
              accountId,
              body,
              idempotencyKey,
            );
            return result as Record<string, unknown>;
          },
          { statusCode: 201 },
        );
        host.sendJson(res, 201, created);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleWalletOperatorReversal(
  req: IncomingMessage,
  res: ServerResponse,
  deps: WalletRouteDeps,
  transactionId: string,
): Promise<void> {
  const host = getWalletHttpHost();
  try {
    const idempotencyKey = host.readIdempotencyKey(req);
    if (idempotencyKey === undefined) {
      throw new Error(host.idempotencyKeyRequiredCode);
    }
    const { parsedBody, rawBody } = await host.readWalletRequestBody(req);
    const body = parseOperatorReversalBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const walletService = await host.resolveWalletService(deps, auth);
    const requestHash = host.hashIdempotentRequest(
      req.method ?? "POST",
      `/wallet/transactions/${transactionId}/reverse`,
      rawBody,
    );
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const created = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => {
            const result = await walletService.reverseTransaction(
              auth,
              transactionId,
              body,
              idempotencyKey,
            );
            return result as Record<string, unknown>;
          },
          { statusCode: 201 },
        );
        host.sendJson(res, 201, created);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}
