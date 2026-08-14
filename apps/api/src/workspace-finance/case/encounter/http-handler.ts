/**
 * @deprecated PR12-B — prefer finance-http `handleFinanceCaseEncounter` + Host port.
 * Kept for direct Host tests; production dispatch uses workspace HTTP routes.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import { getFinanceHttpHost } from "@app-tour/finance-http";

import type { AppDeps } from "../../../app";
import { loadFinanceCaseEncounterHttp } from "./load-finance-case-encounter-http";

export async function handleFinanceCaseEncounterGet(
  req: IncomingMessage,
  res: ServerResponse,
  deps: AppDeps,
  registrationId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const counterpartyId = url.searchParams.get("counterpartyId") ?? "";
    const result = await host.runWithHttpRequestContext(
      req,
      auth,
      async () =>
        loadFinanceCaseEncounterHttp({
          auth,
          registrationId,
          counterpartyId,
          deps: { financeService: deps.financeService },
        }),
      { rateLimit: "read" }
    );
    if (result.status === 200) {
      host.sendJson(res, 200, result.body);
      return;
    }
    host.sendJson(res, result.status, { error: result.error });
  } catch (error) {
    host.handleHttpError(res, error);
  }
}
