import {
  resolveMemberProfileCapabilities,
  type MemberProfileCapabilities,
  type MemberProfileFieldId,
} from "@app-tour/workspace-sdk";

import type {
  MemberProfileViewPayload,
  SerializableMemberProfileCapabilities,
} from "./member-profile-types";
import { withMemberProfileContractVersion } from "./member-profile-contract.server";
import { logMemberProfileEvent } from "./member-profile-observability.server";

export type { MemberProfileViewPayload } from "./member-profile-types";

export type IdentityMeUpstream = {
  readonly userId?: unknown;
  readonly tenantId?: unknown;
  readonly role?: unknown;
  readonly displayName?: unknown;
  readonly mobile?: unknown;
  readonly email?: unknown;
  readonly nationalId?: unknown;
  readonly fatherName?: unknown;
  readonly birthDate?: unknown;
  readonly gender?: unknown;
  readonly avatarUrl?: unknown;
};

export type MemberProfileBffError = {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Partial<Record<MemberProfileFieldId, string>>;
};

const IDENTITY_FIELD_READERS: Readonly<
  Record<MemberProfileFieldId, (identity: IdentityMeUpstream) => string | null>
> = Object.freeze({
  displayName: (identity) => readTrimmedString(identity.displayName),
  mobile: (identity) => readTrimmedString(identity.mobile),
  email: (identity) => readTrimmedString(identity.email),
  nationalId: (identity) => readTrimmedString(identity.nationalId),
  fatherName: (identity) => readTrimmedString(identity.fatherName),
  birthDate: (identity) => readTrimmedString(identity.birthDate),
  gender: (identity) => readTrimmedString(identity.gender),
  avatarUrl: (identity) => readTrimmedString(identity.avatarUrl),
});

const IDENTITY_PATCH_KEYS: Readonly<Record<MemberProfileFieldId, string>> = Object.freeze({
  displayName: "displayName",
  mobile: "mobile",
  email: "email",
  nationalId: "nationalId",
  fatherName: "fatherName",
  birthDate: "birthDate",
  gender: "gender",
  avatarUrl: "avatarUrl",
});

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function listBffIdentityMappedFieldIds(): readonly MemberProfileFieldId[] {
  return Object.keys(IDENTITY_FIELD_READERS) as MemberProfileFieldId[];
}

export function serializeMemberProfileCapabilities(
  capabilities: MemberProfileCapabilities
): SerializableMemberProfileCapabilities {
  return {
    editableFields: capabilities.editableFields,
    readOnlyFields: capabilities.readOnlyFields,
    ...(capabilities.mobileChangeViaOtp === true ? { mobileChangeViaOtp: true } : {}),
    ...(capabilities.sections !== undefined ? { sections: capabilities.sections } : {}),
  };
}

export function listExposedMemberProfileFieldIds(
  capabilities: MemberProfileCapabilities
): readonly MemberProfileFieldId[] {
  return [...capabilities.editableFields, ...capabilities.readOnlyFields];
}

export function pickExposedMemberProfileFields(
  identity: IdentityMeUpstream,
  capabilities: MemberProfileCapabilities
): Partial<Record<MemberProfileFieldId, string | null>> {
  const fields: Partial<Record<MemberProfileFieldId, string | null>> = {};
  for (const fieldId of listExposedMemberProfileFieldIds(capabilities)) {
    const reader = IDENTITY_FIELD_READERS[fieldId];
    fields[fieldId] = reader(identity);
  }
  return fields;
}

export function buildMemberProfileView(
  identity: IdentityMeUpstream,
  pluginId: string,
  options?: { readonly traceId?: string }
): MemberProfileViewPayload | MemberProfileBffError {
  const userId = readTrimmedString(identity.userId);
  const tenantId = readTrimmedString(identity.tenantId);
  const role = readTrimmedString(identity.role);
  if (userId === null || tenantId === null || role === null) {
    return { code: "PROFILE_FETCH_FAILED", status: 502 };
  }

  const capabilities = resolveMemberProfileCapabilities(pluginId);
  if (options?.traceId !== undefined) {
    logMemberProfileEvent({
      traceId: options.traceId,
      kind: "capability_resolve",
      pluginId,
      editableFieldCount: capabilities.editableFields.length,
      readOnlyFieldCount: capabilities.readOnlyFields.length,
    });
  }
  const fields = pickExposedMemberProfileFields(identity, capabilities);
  const avatarUrl = IDENTITY_FIELD_READERS.avatarUrl(identity);
  if (avatarUrl !== null) {
    fields.avatarUrl = avatarUrl;
  }
  return withMemberProfileContractVersion({
    userId,
    tenantId,
    role,
    fields,
    capabilities: serializeMemberProfileCapabilities(capabilities),
  });
}

function isMemberProfileFieldId(
  value: string,
  capabilities: MemberProfileCapabilities
): value is MemberProfileFieldId {
  return (
    capabilities.editableFields.includes(value as MemberProfileFieldId) ||
    capabilities.readOnlyFields.includes(value as MemberProfileFieldId)
  );
}

export type IdentityMePatchBody = Record<string, string | null>;

export function parseMemberProfilePatchBody(
  body: unknown,
  pluginId: string,
  options?: { readonly traceId?: string }
): { readonly patch: IdentityMePatchBody } | MemberProfileBffError {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { code: "INVALID_JSON", status: 400 };
  }

  const fields = (body as Record<string, unknown>).fields;
  if (fields === undefined) {
    return { code: "EMPTY_PATCH", status: 400 };
  }
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
    return { code: "INVALID_PAYLOAD", status: 400 };
  }

  const capabilities = resolveMemberProfileCapabilities(pluginId);
  const patch: IdentityMePatchBody = {};
  const fieldRecord = fields as Record<string, unknown>;
  const fieldErrors: Partial<Record<MemberProfileFieldId, string>> = {};
  let firstValidationCode: string | null = null;

  for (const [rawKey, rawValue] of Object.entries(fieldRecord)) {
    if (!isMemberProfileFieldId(rawKey, capabilities)) {
      return { code: "PROFILE_FIELD_NOT_SUPPORTED", status: 400 };
    }
    if (capabilities.readOnlyFields.includes(rawKey)) {
      return {
        code: "PROFILE_FIELD_READ_ONLY",
        status: 400,
        fieldErrors: { [rawKey]: "PROFILE_FIELD_READ_ONLY" },
      };
    }
    if (typeof rawValue !== "string" && rawValue !== null) {
      return { code: "INVALID_PAYLOAD", status: 400 };
    }
    const normalized = rawValue === null ? "" : rawValue.trim();
    const validator = capabilities.validators[rawKey];
    if (validator !== undefined) {
      const validationCode = validator(normalized);
      if (validationCode !== null) {
        fieldErrors[rawKey] = validationCode;
        if (firstValidationCode === null) {
          firstValidationCode = validationCode;
        }
        continue;
      }
    }
    const upstreamKey = IDENTITY_PATCH_KEYS[rawKey];
    patch[upstreamKey] =
      rawKey === "gender" && normalized.length === 0 ? null : normalized;
  }

  if (firstValidationCode !== null) {
    const errorCount = Object.keys(fieldErrors).length;
    if (options?.traceId !== undefined) {
      logMemberProfileEvent({
        traceId: options.traceId,
        kind: "validation_failure",
        pluginId,
        errorCode: firstValidationCode,
        fieldErrorCount: errorCount,
      });
    }
    return {
      code: firstValidationCode,
      status: 400,
      fieldErrors,
    };
  }

  if (Object.keys(patch).length === 0) {
    return { code: "EMPTY_PATCH", status: 400 };
  }

  return { patch };
}
