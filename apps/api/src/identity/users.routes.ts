import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { OtpRateLimitedError } from "./otp-rate-limit";
import { readIdentityRequestBody } from "./read-identity-request-body";
import { requireOperatorSession } from "./require-operator-session";
import {
  InviteNotFoundError,
  InviteRoleForbiddenError,
  inviteWorkspaceUser,
  listPendingInvites,
  listUsersDirectory,
  MembershipNotFoundError,
  OwnershipTransferForbiddenError,
  OwnershipTransferTargetInvalidError,
  patchWorkspaceUserRewards,
  patchWorkspaceUserRole,
  reactivateWorkspaceUser,
  removeWorkspaceUser,
  resendPendingInvite,
  revokePendingInvite,
  suspendWorkspaceUser,
  transferWorkspaceOwnership,
  getWorkspaceUserBookingSummary,
  getWorkspaceUserRoleHistory,
  bulkPatchWorkspaceUserRoles,
  bulkReactivateWorkspaceUsers,
  bulkRemoveWorkspaceUsers,
  bulkSuspendWorkspaceUsers,
  BulkUserIdsLimitExceededError,
  BulkUserIdsRequiredError,
  MembershipStatusConflictError,
  UsersDirectoryForbiddenError,
  UsersRbacForbiddenError,
} from "./users.service";
import type { PatchUserRewardsRequest } from "./users.types";
import { RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN } from "./users-rbac.policy";
import type { InvitableWorkspaceRole, UsersListQuery } from "./users.types";
import { isInvitableWorkspaceRole } from "./users.types";
import { UsersWorkspaceForbiddenError } from "./users-workspace-guard";

function readStringField(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseUsersListQuery(url: URL): UsersListQuery {
  const roleRaw = url.searchParams.get("role");
  const role =
    roleRaw === "owner" ||
    roleRaw === "admin" ||
    roleRaw === "member" ||
    roleRaw === "viewer"
      ? roleRaw
      : "all";
  const sortRaw = url.searchParams.get("sort");
  const sort =
    sortRaw === "name_desc" ||
    sortRaw === "email_asc" ||
    sortRaw === "email_desc"
      ? sortRaw
      : "name_asc";
  const statusRaw = url.searchParams.get("status");
  const status =
    statusRaw === "active" || statusRaw === "suspended" ? statusRaw : ("all" as const);
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const search = url.searchParams.get("search")?.trim();
  const cursorRaw = url.searchParams.get("cursor")?.trim();

  return {
    ...(search !== undefined && search.length > 0 ? { search } : {}),
    role,
    status,
    sort,
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 50,
    ...(cursorRaw !== undefined && cursorRaw.length > 0 ? { cursor: cursorRaw } : {}),
  };
}

function parseInviteBody(body: unknown): { phone: string; role: InvitableWorkspaceRole; nameNote?: string } {
  const phone = readStringField(body, "phone");
  const roleRaw = readStringField(body, "role");
  const nameNote = readStringField(body, "nameNote");
  if (!isInvitableWorkspaceRole(roleRaw)) {
    throw new InviteRoleForbiddenError();
  }
  return {
    phone,
    role: roleRaw,
    ...(nameNote.length > 0 ? { nameNote } : {}),
  };
}

export async function handleListUsers(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseUsersListQuery(url);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await listUsersDirectory(auth, query);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleInviteUser(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const invite = parseInviteBody(body);

    if (invite.phone.length === 0) {
      sendHttpError(res, 400, { error: "phone_required", code: "PHONE_REQUIRED" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const created = await inviteWorkspaceUser(auth, invite);
        sendJson(res, 201, created);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    if (error instanceof InviteRoleForbiddenError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleListPendingInvites(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await listPendingInvites(auth);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleRevokeInvite(
  req: IncomingMessage,
  res: ServerResponse,
  inviteId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        await revokePendingInvite(auth, inviteId);
        sendJson(res, 204, {});
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    if (error instanceof InviteNotFoundError) {
      sendHttpError(res, 404, { error: "not_found", code: error.code, inviteId: error.inviteId });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleResendInvite(
  req: IncomingMessage,
  res: ServerResponse,
  inviteId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const row = await resendPendingInvite(auth, inviteId);
        sendJson(res, 200, row);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    if (error instanceof InviteNotFoundError) {
      sendHttpError(res, 404, { error: "not_found", code: error.code, inviteId: error.inviteId });
      return;
    }
    if (error instanceof OtpRateLimitedError) {
      sendHttpError(res, 429, { error: error.message, code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}

function parsePatchRoleBody(body: unknown): { role: InvitableWorkspaceRole } {
  const roleRaw = readStringField(body, "role");
  if (!isInvitableWorkspaceRole(roleRaw)) {
    throw new UsersRbacForbiddenError(RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN);
  }
  return { role: roleRaw };
}

function sendUsersAccessForbidden(res: ServerResponse, error: unknown): boolean {
  if (
    error instanceof UsersDirectoryForbiddenError ||
    error instanceof UsersWorkspaceForbiddenError
  ) {
    sendHttpError(res, 403, { error: "forbidden", code: error.code });
    return true;
  }
  return false;
}

function sendRbacOrMembershipErrors(res: ServerResponse, error: unknown): boolean {
  if (sendUsersAccessForbidden(res, error)) {
    return true;
  }
  if (error instanceof UsersRbacForbiddenError) {
    sendHttpError(res, 403, { error: "forbidden", code: error.code });
    return true;
  }
  if (error instanceof MembershipNotFoundError) {
    sendHttpError(res, 404, { error: "not_found", code: error.code, userId: error.userId });
    return true;
  }
  if (error instanceof MembershipStatusConflictError) {
    sendHttpError(res, 409, { error: "conflict", code: error.code });
    return true;
  }
  return false;
}

export async function handlePatchUserRole(
  req: IncomingMessage,
  res: ServerResponse,
  userId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const patch = parsePatchRoleBody(body);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const row = await patchWorkspaceUserRole(auth, userId, patch);
        sendJson(res, 200, row);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (sendRbacOrMembershipErrors(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleRemoveUser(
  req: IncomingMessage,
  res: ServerResponse,
  userId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        await removeWorkspaceUser(auth, userId);
        sendJson(res, 204, {});
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (sendRbacOrMembershipErrors(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleSuspendUser(
  req: IncomingMessage,
  res: ServerResponse,
  userId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const row = await suspendWorkspaceUser(auth, userId);
        sendJson(res, 200, row);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (sendRbacOrMembershipErrors(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleReactivateUser(
  req: IncomingMessage,
  res: ServerResponse,
  userId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const row = await reactivateWorkspaceUser(auth, userId);
        sendJson(res, 200, row);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (sendRbacOrMembershipErrors(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

function parseRewardsBody(body: unknown): PatchUserRewardsRequest {
  if (typeof body !== "object" || body === null) {
    return {};
  }
  const record = body as Record<string, unknown>;
  const patch: PatchUserRewardsRequest = {};
  if ("permanentDiscountPercentage" in record) {
    const value = record.permanentDiscountPercentage;
    patch.permanentDiscountPercentage =
      value === null ? null : typeof value === "number" ? value : undefined;
  }
  if (Array.isArray(record.badges)) {
    patch.badges = record.badges.filter((badge): badge is string => typeof badge === "string");
  }
  if (typeof record.isSelectableLeader === "boolean") {
    patch.isSelectableLeader = record.isSelectableLeader;
  }
  if (Array.isArray(record.labels)) {
    patch.labels = record.labels.filter((label): label is string => typeof label === "string");
  }
  return patch;
}

export async function handlePatchUserRewards(
  req: IncomingMessage,
  res: ServerResponse,
  userId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const patch = parseRewardsBody(body);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const row = await patchWorkspaceUserRewards(auth, userId, patch);
        sendJson(res, 200, row);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (sendRbacOrMembershipErrors(res, error)) {
      return;
    }
    if (error instanceof Error && error.message.startsWith("REWARDS_")) {
      sendHttpError(res, 400, { error: "validation_error", code: error.message });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleTransferWorkspaceOwnership(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const newOwnerUserId = readStringField(body, "newOwnerUserId");
    if (newOwnerUserId.length === 0) {
      sendHttpError(res, 400, { error: "validation_error", code: "NEW_OWNER_USER_ID_REQUIRED" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await transferWorkspaceOwnership(auth, tenantId, newOwnerUserId);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (error instanceof OwnershipTransferForbiddenError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code, reason: error.reason });
      return;
    }
    if (error instanceof OwnershipTransferTargetInvalidError) {
      sendHttpError(res, 400, { error: "validation_error", code: error.code, userId: error.userId });
      return;
    }
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleGetUserRoleHistory(
  req: IncomingMessage,
  res: ServerResponse,
  userId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await getWorkspaceUserRoleHistory(auth, userId);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    if (error instanceof MembershipNotFoundError) {
      sendHttpError(res, 404, { error: "not_found", code: error.code, userId: error.userId });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleGetUserBookingSummary(
  req: IncomingMessage,
  res: ServerResponse,
  userId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await getWorkspaceUserBookingSummary(auth, userId);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    if (error instanceof MembershipNotFoundError) {
      sendHttpError(res, 404, { error: "not_found", code: error.code, userId: error.userId });
      return;
    }
    handleHttpError(res, error);
  }
}

function parseBulkUserIdsBody(body: unknown): readonly string[] {
  if (typeof body !== "object" || body === null || !Array.isArray((body as Record<string, unknown>).userIds)) {
    return [];
  }
  return (body as { userIds: unknown[] }).userIds
    .filter((userId): userId is string => typeof userId === "string")
    .map((userId) => userId.trim())
    .filter((userId) => userId.length > 0);
}

function parseBulkRoleBody(body: unknown): { userIds: readonly string[]; role: InvitableWorkspaceRole } {
  const userIds = parseBulkUserIdsBody(body);
  const roleRaw =
    typeof body === "object" && body !== null && typeof (body as Record<string, unknown>).role === "string"
      ? ((body as Record<string, unknown>).role as string).trim()
      : "";
  if (!isInvitableWorkspaceRole(roleRaw)) {
    throw new InviteRoleForbiddenError();
  }
  return { userIds, role: roleRaw };
}

function handleBulkValidationError(res: ServerResponse, error: unknown): boolean {
  if (error instanceof BulkUserIdsRequiredError) {
    sendHttpError(res, 400, { error: "validation_error", code: error.code });
    return true;
  }
  if (error instanceof BulkUserIdsLimitExceededError) {
    sendHttpError(res, 400, { error: "validation_error", code: error.code });
    return true;
  }
  return false;
}

export async function handleBulkPatchUserRole(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const parsed = parseBulkRoleBody(body);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await bulkPatchWorkspaceUserRoles(auth, parsed.userIds, parsed.role);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (handleBulkValidationError(res, error)) {
      return;
    }
    if (error instanceof InviteRoleForbiddenError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code });
      return;
    }
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleBulkSuspendUsers(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await bulkSuspendWorkspaceUsers(auth, parseBulkUserIdsBody(body));
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (handleBulkValidationError(res, error)) {
      return;
    }
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleBulkReactivateUsers(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await bulkReactivateWorkspaceUsers(auth, parseBulkUserIdsBody(body));
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (handleBulkValidationError(res, error)) {
      return;
    }
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleBulkRemoveUsers(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await bulkRemoveWorkspaceUsers(auth, parseBulkUserIdsBody(body));
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (handleBulkValidationError(res, error)) {
      return;
    }
    if (sendUsersAccessForbidden(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}
