import type { IncomingMessage, ServerResponse } from "node:http";

import { parseOperationalRosterListQuery } from "@app-tour/workspace-denali/roster";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { listTourOperationalRoster } from "./operational-roster.service.ts";
import { createFinalRosterExport } from "./final-roster-export";
import { resolveLazyToursService } from "../boot/lazy-tours-service";
import { getTourOperator } from "../tours/get-tour-operator";
import type { ToursService } from "../tours/tours.service";

export async function handleGetTourOperationalRoster(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseOperationalRosterListQuery(url);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await listTourOperationalRoster(auth, tourId, query);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleExportTourFinalRoster(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  toursService?: ToursService
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        if (
          url.searchParams.get("filter") !== "final" ||
          url.searchParams.get("format") !== "xlsx"
        ) {
          sendJson(res, 400, {
            error: "invalid_query",
            code: "TOUR_ROSTER_EXPORT_FORMAT_INVALID",
          });
          return;
        }
        const tour = await getTourOperator(
          await resolveLazyToursService(toursService),
          auth,
          tourId
        );
        if (tour === null) {
          throw new Error("TOUR_NOT_FOUND");
        }
        const result = await createFinalRosterExport(auth, tourId, tour.projection.title);
        res.statusCode = 200;
        res.setHeader("Content-Type", result.contentType);
        res.setHeader("Content-Disposition", `attachment; filename=\"${result.filename}\"`);
        res.setHeader("Cache-Control", "no-store");
        res.end(result.body);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
