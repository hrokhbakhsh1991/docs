import type { ActorRole, MembershipStatus, TenantAuthContext } from "./auth-context";
import { assertAuthScopeId } from "./auth-id-format";
import { InvalidTenantAuthContextError } from "./auth-context-errors";
import type { PluginSubject, TenantSubject, WorkspaceSubject, WorkspaceThemeSubject } from "./subjects";
import {
  parseAuthRecord,
  requireNonEmptyAuthString,
  type AuthRecordFieldSpec,
} from "./parse-auth-record";

const ROLES: readonly ActorRole[] = ["owner", "admin", "member", "none"];
const STATUSES: readonly MembershipStatus[] = ["ACTIVE", "SUSPENDED"];

function parseRole(value: unknown): ActorRole {
  if (!ROLES.includes(value as ActorRole)) {
    throw new InvalidTenantAuthContextError(
      "AUTH_ROLE_INVALID",
      `role must be one of: ${ROLES.join(", ")}`,
    );
  }
  return value as ActorRole;
}

function parseStatus(value: unknown): MembershipStatus {
  if (!STATUSES.includes(value as MembershipStatus)) {
    throw new InvalidTenantAuthContextError(
      "AUTH_STATUS_INVALID",
      `status must be one of: ${STATUSES.join(", ")}`,
    );
  }
  return value as MembershipStatus;
}

const TENANT_CONTEXT_FIELDS: readonly AuthRecordFieldSpec<unknown>[] = [
  {
    key: "userId",
    required: true,
    parse: (v) => {
      const id = requireNonEmptyAuthString(v, "userId", "AUTH_USER_ID_INVALID");
      assertAuthScopeId("userId", id, "AUTH_SCOPE_ID_INVALID");
      return id;
    },
  },
  {
    key: "tenantId",
    required: true,
    parse: (v) => {
      const id = requireNonEmptyAuthString(v, "tenantId", "AUTH_TENANT_ID_INVALID");
      assertAuthScopeId("tenantId", id, "AUTH_SCOPE_ID_INVALID");
      return id;
    },
  },
  { key: "role", required: true, parse: parseRole },
  { key: "status", required: true, parse: parseStatus },
  {
    key: "workspaceId",
    required: false,
    parse: (v) => {
      const id = requireNonEmptyAuthString(v, "workspaceId", "AUTH_WORKSPACE_ID_INVALID");
      assertAuthScopeId("workspaceId", id, "AUTH_SCOPE_ID_INVALID");
      return id;
    },
  },
];

/**
 * Strict runtime parse (no `any`, no Zod dependency) — fail-closed before ability build.
 */
export function parseTenantAuthContext(input: unknown): TenantAuthContext {
  return parseAuthRecord(input, "TenantAuthContext", TENANT_CONTEXT_FIELDS, (parsed) => ({
    userId: parsed.userId as string,
    tenantId: parsed.tenantId as string,
    role: parsed.role as ActorRole,
    status: parsed.status as MembershipStatus,
    workspaceId: parsed.workspaceId as string | undefined,
  }));
}

export function parseWorkspaceThemeSubject(input: unknown): WorkspaceThemeSubject {
  return parseAuthRecord(
    input,
    "WorkspaceThemeSubject",
    [
      {
        key: "tenantId",
        required: true,
        parse: (v) => {
          const id = requireNonEmptyAuthString(v, "tenantId", "AUTH_TENANT_ID_INVALID");
          assertAuthScopeId("tenantId", id, "AUTH_SCOPE_ID_INVALID");
          return id;
        },
      },
      {
        key: "workspaceId",
        required: true,
        parse: (v) => {
          const id = requireNonEmptyAuthString(v, "workspaceId", "AUTH_WORKSPACE_ID_INVALID");
          assertAuthScopeId("workspaceId", id, "AUTH_SCOPE_ID_INVALID");
          return id;
        },
      },
      {
        key: "pluginId",
        required: true,
        parse: (v) => {
          const id = requireNonEmptyAuthString(v, "pluginId", "AUTH_SCOPE_ID_INVALID");
          assertAuthScopeId("pluginId", id, "AUTH_SCOPE_ID_INVALID");
          return id;
        },
      },
    ],
    (parsed) => parsed as unknown as WorkspaceThemeSubject,
  );
}

export function parseTenantSubject(input: unknown): TenantSubject {
  return parseAuthRecord(
    input,
    "TenantSubject",
    [
      {
        key: "tenantId",
        required: true,
        parse: (v) => {
          const id = requireNonEmptyAuthString(v, "tenantId", "AUTH_TENANT_ID_INVALID");
          assertAuthScopeId("tenantId", id, "AUTH_SCOPE_ID_INVALID");
          return id;
        },
      },
    ],
    (parsed) => ({ tenantId: parsed.tenantId as string }),
  );
}

export function parseWorkspaceSubject(input: unknown): WorkspaceSubject {
  return parseAuthRecord(
    input,
    "WorkspaceSubject",
    [
      {
        key: "tenantId",
        required: true,
        parse: (v) => {
          const id = requireNonEmptyAuthString(v, "tenantId", "AUTH_TENANT_ID_INVALID");
          assertAuthScopeId("tenantId", id, "AUTH_SCOPE_ID_INVALID");
          return id;
        },
      },
      {
        key: "workspaceId",
        required: true,
        parse: (v) => {
          const id = requireNonEmptyAuthString(v, "workspaceId", "AUTH_WORKSPACE_ID_INVALID");
          assertAuthScopeId("workspaceId", id, "AUTH_SCOPE_ID_INVALID");
          return id;
        },
      },
    ],
    (parsed) => ({
      tenantId: parsed.tenantId as string,
      workspaceId: parsed.workspaceId as string,
    }),
  );
}

export function parsePluginSubject(input: unknown): PluginSubject {
  return parseAuthRecord(
    input,
    "PluginSubject",
    [
      {
        key: "tenantId",
        required: true,
        parse: (v) => {
          const id = requireNonEmptyAuthString(v, "tenantId", "AUTH_TENANT_ID_INVALID");
          assertAuthScopeId("tenantId", id, "AUTH_SCOPE_ID_INVALID");
          return id;
        },
      },
      {
        key: "pluginId",
        required: true,
        parse: (v) => {
          const id = requireNonEmptyAuthString(v, "pluginId", "AUTH_SCOPE_ID_INVALID");
          assertAuthScopeId("pluginId", id, "AUTH_SCOPE_ID_INVALID");
          return id;
        },
      },
    ],
    (parsed) => ({
      tenantId: parsed.tenantId as string,
      pluginId: parsed.pluginId as string,
    }),
  );
}
