import { cookies, headers } from "next/headers";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { validateSessionToken } from "@/auth/validate-session-token";

import {
  resolveBootstrapAppSession,
  resolveBootstrapAppSessionForHost,
} from "./tenant-kernel.server";
import type { ResolvedBootstrapSession, TenantKernelResolveInput } from "./tenant-kernel.types";

function normalizeSessionRole(
  role: string | undefined
): TenantAuthContext["role"] | null {
  if (role === "owner" || role === "admin" || role === "member") {
    return role;
  }
  return null;
}

function resolveWorkspaceIdForSessionMerge(
  base: TenantAuthContext,
  validation: Extract<Awaited<ReturnType<typeof validateSessionToken>>, { status: "valid" }>
): string | null {
  const fromToken = validation.workspaceId?.trim();
  if (fromToken !== undefined && fromToken.length > 0) {
    return fromToken;
  }
  const fromBase = base.workspaceId?.trim();
  if (fromBase !== undefined && fromBase.length > 0) {
    return fromBase;
  }
  return null;
}

function mergeAuthenticatedSessionInput(
  base: TenantAuthContext,
  validation: Extract<Awaited<ReturnType<typeof validateSessionToken>>, { status: "valid" }>
): TenantKernelResolveInput | null {
  const role = normalizeSessionRole(validation.role);
  const workspaceId = resolveWorkspaceIdForSessionMerge(base, validation);
  if (role === null || workspaceId === null) {
    return null;
  }

  return {
    userId: validation.userId,
    tenantId: validation.tenantId,
    workspaceId,
    role,
    status: "ACTIVE",
  };
}

/**
 * Per-request bootstrap: dev host/env defaults, overridden by signed session JWT when present.
 * Keeps client `useAppSession().workspaceId` aligned with API auth (`workspace_id` claim).
 */
export async function resolveRequestBootstrapAppSession(): Promise<ResolvedBootstrapSession> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const baseResolved = resolveBootstrapAppSessionForHost(host);

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value;
  const validation = await validateSessionToken(token);
  if (validation.status !== "valid") {
    return baseResolved;
  }

  const mergedInput = mergeAuthenticatedSessionInput(baseResolved.context, validation);
  if (mergedInput === null) {
    return baseResolved;
  }

  return resolveBootstrapAppSession(mergedInput, host);
}
