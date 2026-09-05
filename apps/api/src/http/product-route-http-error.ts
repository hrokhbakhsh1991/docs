import type { ServerResponse } from "node:http";

import { resolveTicketingHttpError } from "@app-tour/ticketing-http";
import { resolveWalletHttpError } from "@app-tour/wallet-http";

import {
  handleHttpError,
  resolveCorrelationId,
  sendHttpError,
} from "../middleware/error-interceptor";

export function handleTicketingRouteHttpError(res: ServerResponse, error: unknown): void {
  const ticketingHttp = resolveTicketingHttpError(error);
  if (ticketingHttp !== null) {
    sendHttpError(
      res,
      ticketingHttp.status,
      {
        error: "ticketing_error",
        code: ticketingHttp.code,
        ...(ticketingHttp.field !== undefined ? { field: ticketingHttp.field } : {}),
      },
      resolveCorrelationId(),
    );
    return;
  }
  handleHttpError(res, error);
}

export function handleWalletRouteHttpError(res: ServerResponse, error: unknown): void {
  const walletHttp = resolveWalletHttpError(error);
  if (walletHttp !== null) {
    sendHttpError(
      res,
      walletHttp.status,
      {
        error: "wallet_error",
        code: walletHttp.code,
      },
      resolveCorrelationId(),
    );
    return;
  }
  handleHttpError(res, error);
}
