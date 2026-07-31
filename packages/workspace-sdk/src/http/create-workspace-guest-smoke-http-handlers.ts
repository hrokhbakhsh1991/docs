/**
 * Shared guest-smoke catalog/registration HTTP handlers (DG-4.3 / DG-4.6).
 * Workspaces supply seed gate + fixture card, or an optional catalog port.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import {
  buildWorkspaceCatalogListSuccessBody,
  parseWorkspaceCatalogCursorLimitQuery,
} from "./workspace-catalog-list";
import {
  buildWorkspaceSuccessDataBody,
  readWorkspaceJsonBody,
  sendWorkspaceGuestStub,
  sendWorkspaceJson,
  sendWorkspaceNotFound,
} from "./guest-json-response";

export type WorkspaceGuestSmokeHttpHandlers = {
  readonly handleList: (
    req: IncomingMessage,
    res: ServerResponse,
  ) => Promise<void>;
  readonly handleDetail: (
    req: IncomingMessage,
    res: ServerResponse,
    tourId: string,
  ) => Promise<void>;
  readonly handleRegister: (
    req: IncomingMessage,
    res: ServerResponse,
  ) => Promise<void>;
};

export type WorkspaceGuestSmokeRegistrationInput = {
  readonly tourId: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly partySize: number;
};

export type WorkspaceGuestSmokeRegistrationResult = {
  readonly id: string;
  readonly tourId: string;
  readonly status: string;
};

/** Optional replaceable catalog/registration surface (DG-4.6). */
export type WorkspaceGuestSmokeCatalogPort<TCard> = {
  readonly listPublished: () => readonly TCard[];
  readonly getPublished: (tourId: string) => TCard | null;
  readonly createRegistration: (
    input: WorkspaceGuestSmokeRegistrationInput,
  ) => WorkspaceGuestSmokeRegistrationResult;
};

export type CreateWorkspaceGuestSmokeHttpHandlersOptions<TCard> = {
  readonly isSeedEnabled: () => boolean;
  readonly publishedTourId: string;
  readonly buildCard: () => TCard;
  /** When set, list/detail/register go through the port (fixture helpers may still seed it). */
  readonly catalogPort?: WorkspaceGuestSmokeCatalogPort<TCard>;
  /** Optional list filter (e.g. city query). Defaults to identity. */
  readonly filterListItems?: (
    items: readonly TCard[],
    url: URL,
  ) => readonly TCard[];
  /** When true, apply `limit` from shared catalog query parser. */
  readonly applyListLimit?: boolean;
};

export function createWorkspaceGuestSmokeHttpHandlers<TCard>(
  options: CreateWorkspaceGuestSmokeHttpHandlersOptions<TCard>,
): WorkspaceGuestSmokeHttpHandlers {
  const filterListItems = options.filterListItems ?? ((items) => items);
  const applyListLimit = options.applyListLimit === true;
  const port = options.catalogPort;

  return {
    async handleList(req, res): Promise<void> {
      if (!options.isSeedEnabled()) {
        sendWorkspaceGuestStub(res);
        return;
      }
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const source = port ? port.listPublished() : [options.buildCard()];
      const filtered = filterListItems(source, url);
      const { limit } = applyListLimit
        ? parseWorkspaceCatalogCursorLimitQuery(url)
        : {};
      const items =
        typeof limit === "number" ? filtered.slice(0, Math.max(limit, 0)) : filtered;
      sendWorkspaceJson(
        res,
        200,
        buildWorkspaceCatalogListSuccessBody({ items, nextCursor: null }),
      );
    },

    async handleDetail(_req, res, tourId): Promise<void> {
      if (!options.isSeedEnabled()) {
        sendWorkspaceGuestStub(res);
        return;
      }
      const card = port
        ? port.getPublished(tourId.trim())
        : tourId.trim() === options.publishedTourId
          ? options.buildCard()
          : null;
      if (card === null) {
        sendWorkspaceNotFound(res);
        return;
      }
      sendWorkspaceJson(res, 200, buildWorkspaceSuccessDataBody(card));
    },

    async handleRegister(req, res): Promise<void> {
      if (!options.isSeedEnabled()) {
        sendWorkspaceGuestStub(res);
        return;
      }
      try {
        const raw = (await readWorkspaceJsonBody(req)) as {
          tourId?: unknown;
          contact?: { fullName?: unknown; email?: unknown };
          partySize?: unknown;
        };
        const tourId = typeof raw.tourId === "string" ? raw.tourId.trim() : "";
        const fullName =
          typeof raw.contact?.fullName === "string"
            ? raw.contact.fullName.trim()
            : "";
        const email =
          typeof raw.contact?.email === "string" ? raw.contact.email.trim() : null;
        const partySize =
          typeof raw.partySize === "number"
            ? raw.partySize
            : Number.parseInt(String(raw.partySize ?? ""), 10);

        if (port) {
          if (port.getPublished(tourId) === null) {
            sendWorkspaceNotFound(res);
            return;
          }
        } else if (tourId !== options.publishedTourId) {
          sendWorkspaceNotFound(res);
          return;
        }
        if (fullName.length === 0 || !Number.isFinite(partySize) || partySize < 1) {
          sendWorkspaceJson(res, 400, { success: false, code: "INVALID_PAYLOAD" });
          return;
        }

        const created = port
          ? port.createRegistration({
              tourId,
              fullName,
              email,
              partySize,
            })
          : {
              id: `00000000-0000-4000-8000-${String(Date.now()).slice(-12)}`,
              tourId,
              status: "pending",
            };

        sendWorkspaceJson(res, 201, buildWorkspaceSuccessDataBody(created));
      } catch {
        sendWorkspaceJson(res, 400, { success: false, code: "INVALID_PAYLOAD" });
      }
    },
  };
}
