import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { readJsonBody, sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import {
  TourExecutionForbiddenError,
  TourExecutionInvalidStateError,
  TourExecutionInvalidTransitionError,
  TourExecutionNotFoundError,
  TourExecutionVersionConflictError,
} from "./tour-execution-authorization";
import type { TourExecutionState } from "./tour-execution.types";
import {
  assignManifestRowGroup,
  createTourExecutionOperationalEvent,
  getMemberTourExecutionSummary,
  getOrBootstrapTourExecution,
  lockTourExecutionManifest,
  patchTourExecutionLocation,
  patchTourExecutionSchedule,
  patchTourExecutionTourLeader,
  replaceTourExecutionGroups,
  toggleTourExecutionChecklistItem,
  transitionTourExecutionState,
} from "./tour-execution.service";
import { exportTourExecutionManifestXlsx } from "./tour-execution-manifest-export.service";
import { TourExecutionInvalidLeaderError } from "./tour-execution-leader.util";

function mapTourExecutionError(res: ServerResponse, error: unknown): boolean {
  if (error instanceof TourExecutionNotFoundError) {
    sendHttpError(res, 404, { error: "not_found", code: error.message });
    return true;
  }
  if (error instanceof TourExecutionForbiddenError) {
    sendHttpError(res, 403, { error: "forbidden", code: error.message });
    return true;
  }
  if (error instanceof TourExecutionVersionConflictError) {
    sendHttpError(res, 409, { error: "conflict", code: error.message });
    return true;
  }
  if (error instanceof TourExecutionInvalidTransitionError) {
    sendHttpError(res, 409, {
      error: "conflict",
      code: error.message,
      from: error.from,
      to: error.to,
    });
    return true;
  }
  if (error instanceof TourExecutionInvalidStateError) {
    sendHttpError(res, 409, { error: "conflict", code: error.message, state: error.state });
    return true;
  }
  if (error instanceof TourExecutionInvalidLeaderError) {
    sendHttpError(res, 400, { error: "invalid_body", code: error.message });
    return true;
  }
  return false;
}

export async function handleGetTourExecution(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const execution = await getOrBootstrapTourExecution(auth, tourId);
        sendJson(res, 200, execution);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    if (mapTourExecutionError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleLockTourExecutionManifest(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const execution = await lockTourExecutionManifest(auth, tourId);
        sendJson(res, 200, execution);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    if (mapTourExecutionError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePatchTourExecutionState(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as {
      readonly targetState?: unknown;
      readonly expectedVersion?: unknown;
    };
    const targetState =
      typeof body.targetState === "string" ? (body.targetState as TourExecutionState) : null;
    const expectedVersion =
      typeof body.expectedVersion === "number" ? body.expectedVersion : Number(body.expectedVersion);
    if (targetState === null || !Number.isInteger(expectedVersion)) {
      sendHttpError(res, 400, { error: "invalid_body", code: "TOUR_EXECUTION_INVALID_BODY" });
      return;
    }
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const execution = await transitionTourExecutionState({
          auth,
          tourId,
          targetState,
          expectedVersion,
        });
        sendJson(res, 200, execution);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    if (mapTourExecutionError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePutTourExecutionGroups(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as { readonly groups?: unknown };
    const groups = Array.isArray(body.groups)
      ? body.groups.filter(
          (item): item is { name: string; leaderUserId?: string | null } =>
            item !== null && typeof item === "object" && typeof (item as { name?: unknown }).name === "string",
        )
      : [];
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const execution = await replaceTourExecutionGroups({ auth, tourId, groups });
        sendJson(res, 200, execution);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    if (mapTourExecutionError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePatchTourExecutionManifestGroup(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  registrationId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as { readonly groupId?: unknown };
    const groupId =
      body.groupId === null || body.groupId === undefined
        ? null
        : typeof body.groupId === "string"
          ? body.groupId
          : null;
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const execution = await assignManifestRowGroup({
          auth,
          tourId,
          registrationId,
          groupId,
        });
        sendJson(res, 200, execution);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    if (mapTourExecutionError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePatchTourExecutionChecklistItem(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  itemId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as { readonly completed?: unknown };
    const completed = body.completed === true;
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const execution = await toggleTourExecutionChecklistItem({
          auth,
          tourId,
          itemId,
          completed,
        });
        sendJson(res, 200, execution);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    if (mapTourExecutionError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePostTourExecutionOperationalEvent(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as {
      readonly eventKind?: unknown;
      readonly severity?: unknown;
      readonly description?: unknown;
      readonly metadata?: unknown;
    };
    if (typeof body.eventKind !== "string" || typeof body.description !== "string") {
      sendHttpError(res, 400, { error: "invalid_body", code: "TOUR_EXECUTION_INVALID_BODY" });
      return;
    }
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const execution = await createTourExecutionOperationalEvent({
          auth,
          tourId,
          eventKind: body.eventKind,
          severity: typeof body.severity === "string" ? body.severity : undefined,
          description: body.description,
          metadata:
            body.metadata !== null && typeof body.metadata === "object" && !Array.isArray(body.metadata)
              ? (body.metadata as Readonly<Record<string, unknown>>)
              : undefined,
        });
        sendJson(res, 200, execution);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    if (mapTourExecutionError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePatchTourExecutionSchedule(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as {
      readonly scheduledMeetingAt?: unknown;
      readonly idempotencyKey?: unknown;
    };
    if (typeof body.scheduledMeetingAt !== "string") {
      sendHttpError(res, 400, { error: "invalid_body", code: "TOUR_EXECUTION_INVALID_BODY" });
      return;
    }
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const execution = await patchTourExecutionSchedule({
          auth,
          tourId,
          scheduledMeetingAt: body.scheduledMeetingAt,
          idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
        });
        sendJson(res, 200, execution);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    if (mapTourExecutionError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePatchTourExecutionLocation(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as {
      readonly meetingLocation?: unknown;
      readonly idempotencyKey?: unknown;
    };
    if (typeof body.meetingLocation !== "string") {
      sendHttpError(res, 400, { error: "invalid_body", code: "TOUR_EXECUTION_INVALID_BODY" });
      return;
    }
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const execution = await patchTourExecutionLocation({
          auth,
          tourId,
          meetingLocation: body.meetingLocation,
          idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
        });
        sendJson(res, 200, execution);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    if (mapTourExecutionError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handlePatchTourExecutionTourLeader(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as {
      readonly tourLeaderUserId?: unknown;
      readonly idempotencyKey?: unknown;
    };
    const tourLeaderUserId =
      body.tourLeaderUserId === null
        ? null
        : typeof body.tourLeaderUserId === "string"
          ? body.tourLeaderUserId
          : undefined;
    if (tourLeaderUserId === undefined) {
      sendHttpError(res, 400, { error: "invalid_body", code: "TOUR_EXECUTION_INVALID_BODY" });
      return;
    }
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const execution = await patchTourExecutionTourLeader({
          auth,
          tourId,
          tourLeaderUserId,
          idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
        });
        sendJson(res, 200, execution);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    if (mapTourExecutionError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleGetMemberTourExecutionSummary(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    if (auth.role !== "member" && auth.role !== "admin" && auth.role !== "owner") {
      sendHttpError(res, 403, { error: "forbidden", code: "TOUR_EXECUTION_SUMMARY_FORBIDDEN" });
      return;
    }
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const summary = await getMemberTourExecutionSummary({
          tenantId: auth.tenantId,
          userId: auth.userId,
          tourId,
        });
        if (summary === null) {
          sendHttpError(res, 404, { error: "not_found", code: "TOUR_EXECUTION_SUMMARY_NOT_FOUND" });
          return;
        }
        sendJson(res, 200, summary);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleGetTourExecutionManifestExport(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const url = new URL(req.url ?? "", "http://localhost");
    const locale = url.searchParams.get("locale") ?? undefined;
    const includeGroups = url.searchParams.get("includeGroups") === "1";
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const exported = await exportTourExecutionManifestXlsx({
          auth,
          tourId,
          locale,
          includeGroups,
        });
        res.statusCode = 200;
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader("Content-Disposition", `attachment; filename="${exported.filename}"`);
        res.end(exported.buffer);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    if (mapTourExecutionError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}
