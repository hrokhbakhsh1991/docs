import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { readJsonBody } from "../http/json";
import { sendJson } from "../http/json";
import { handleHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import {
  approveDriverSettlementPayable,
  confirmDriverSettlement,
  createCorrectionSettlement,
  freezeTourRosterAndGenerateSettlements,
  listDriverSettlementsForTour,
} from "./driver-settlement.service.ts";

export async function handleFreezeTourRoster(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as {
      readonly driverCompensationPerSeatMinor?: string;
      readonly currency?: string;
    };
    if (typeof body.driverCompensationPerSeatMinor !== "string") {
      sendJson(res, 400, { code: "INVALID_BODY", message: "driverCompensationPerSeatMinor required" });
      return;
    }
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await freezeTourRosterAndGenerateSettlements(auth, tourId, {
          driverCompensationPerSeatMinor: body.driverCompensationPerSeatMinor,
          currency: typeof body.currency === "string" ? body.currency : "IRR",
        });
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleListDriverSettlements(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const settlements = await listDriverSettlementsForTour(auth, tourId);
        sendJson(res, 200, { tourId, settlements });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleConfirmDriverSettlement(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  settlementId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const settlement = await confirmDriverSettlement(auth, tourId, settlementId);
        sendJson(res, 200, { settlement });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleApproveDriverSettlementPayable(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  settlementId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await approveDriverSettlementPayable(auth, tourId, settlementId);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleCreateDriverSettlementCorrection(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  settlementId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as {
      readonly billableQuantity?: number;
      readonly unitAmountMinor?: string;
      readonly currency?: string;
    };
    if (typeof body.billableQuantity !== "number" || typeof body.unitAmountMinor !== "string") {
      sendJson(res, 400, { code: "INVALID_BODY", message: "billableQuantity and unitAmountMinor required" });
      return;
    }
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const settlement = await createCorrectionSettlement(auth, tourId, settlementId, {
          billableQuantity: body.billableQuantity,
          unitAmountMinor: body.unitAmountMinor,
          currency: typeof body.currency === "string" ? body.currency : "IRR",
        });
        sendJson(res, 201, { settlement });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
