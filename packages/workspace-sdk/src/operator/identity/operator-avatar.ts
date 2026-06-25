export {
  OPERATOR_AVATAR_ALLOWED_CONTENT_TYPES,
  OPERATOR_AVATAR_MAX_BYTES,
  isOperatorAvatarContentType,
  type OperatorAvatarContentType,
} from "./operator-avatar-types";

export type OperatorMembershipAvatar = {
  readonly storageKey: string;
  readonly contentType?: string;
};

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Single avatar object per tenant membership — overwrite on re-upload. */
export function buildOperatorAvatarObjectKey(tenantId: string, userId: string): string {
  const normalizedTenant = tenantId.trim().toLowerCase();
  const normalizedUser = userId.trim().toLowerCase();
  if (!UUID_SEGMENT.test(normalizedTenant)) {
    throw new Error("OPERATOR_AVATAR_TENANT_ID_INVALID");
  }
  if (!UUID_SEGMENT.test(normalizedUser)) {
    throw new Error("OPERATOR_AVATAR_USER_ID_INVALID");
  }
  return `${normalizedTenant}/operators/${normalizedUser}/avatar`;
}

export function assertOperatorAvatarKeyScope(
  key: string,
  tenantId: string,
  userId: string
): void {
  const expected = buildOperatorAvatarObjectKey(tenantId, userId);
  if (key.trim() !== expected) {
    throw new Error("OPERATOR_AVATAR_KEY_FORBIDDEN");
  }
}

export function isOperatorAvatarStorageKey(key: string): boolean {
  const trimmed = key.trim();
  const operatorsIndex = trimmed.indexOf("/operators/");
  if (operatorsIndex <= 0) {
    return false;
  }
  const tenantSegment = trimmed.slice(0, operatorsIndex);
  if (!UUID_SEGMENT.test(tenantSegment)) {
    return false;
  }
  const suffix = trimmed.slice(operatorsIndex + "/operators/".length);
  const slash = suffix.indexOf("/");
  if (slash <= 0) {
    return false;
  }
  const userSegment = suffix.slice(0, slash);
  const tail = suffix.slice(slash + 1);
  return UUID_SEGMENT.test(userSegment) && tail === "avatar";
}

export {
  assertTenantBrandLogoBytesMatchContentType as assertOperatorAvatarBytesMatchContentType,
  sniffTenantBrandLogoContentType as sniffOperatorAvatarContentType,
} from "../../theme/tenant-brand-logo-bytes";
