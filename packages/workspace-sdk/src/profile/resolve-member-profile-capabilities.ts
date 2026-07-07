import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

import type { MemberProfileFieldId } from "./member-profile-field-id";
import {
  type MemberProfileFieldValidator,
  validateMemberProfileBirthDate,
  validateMemberProfileDisplayName,
  validateMemberProfileEmail,
  validateMemberProfileFatherName,
  validateMemberProfileNationalId,
} from "./member-profile-validators";
import { WORKSPACE_MEMBER_PROFILE_CAPABILITIES } from "./workspace-member-profile-capabilities.generated";

export type MemberProfileSection = {
  readonly id: string;
  readonly fields: readonly MemberProfileFieldId[];
};

export type MemberProfileCapabilities = {
  readonly editableFields: readonly MemberProfileFieldId[];
  readonly readOnlyFields: readonly MemberProfileFieldId[];
  readonly mobileChangeViaOtp?: boolean;
  readonly sections?: readonly MemberProfileSection[];
  /** Field validators for BFF/API — not for portal UI execution. */
  readonly validators: Readonly<Partial<Record<MemberProfileFieldId, MemberProfileFieldValidator>>>;
};

export class MemberProfileNotConfiguredError extends Error {
  readonly code = "MEMBER_PROFILE_NOT_CONFIGURED" as const;

  constructor(pluginId: string) {
    super(`MEMBER_PROFILE_NOT_CONFIGURED:${pluginId}`);
    this.name = "MemberProfileNotConfiguredError";
  }
}

const FIELD_VALIDATORS: Readonly<Partial<Record<MemberProfileFieldId, MemberProfileFieldValidator>>> =
  Object.freeze({
    displayName: validateMemberProfileDisplayName,
    email: validateMemberProfileEmail,
    nationalId: validateMemberProfileNationalId,
    fatherName: validateMemberProfileFatherName,
    birthDate: validateMemberProfileBirthDate,
  });

function attachValidators(
  editableFields: readonly MemberProfileFieldId[]
): Readonly<Partial<Record<MemberProfileFieldId, MemberProfileFieldValidator>>> {
  const validators: Partial<Record<MemberProfileFieldId, MemberProfileFieldValidator>> = {};
  for (const fieldId of editableFields) {
    const validator = FIELD_VALIDATORS[fieldId];
    if (validator !== undefined) {
      validators[fieldId] = validator;
    }
  }
  return Object.freeze(validators);
}

/** Portal member profile UI + BFF capability registry (manifest-generated). */
export function resolveMemberProfileCapabilities(
  pluginId: WorkspacePluginId | string
): MemberProfileCapabilities {
  const generated = WORKSPACE_MEMBER_PROFILE_CAPABILITIES[pluginId];
  if (generated === undefined) {
    throw new MemberProfileNotConfiguredError(pluginId);
  }
  return Object.freeze({
    editableFields: generated.editableFields,
    readOnlyFields: generated.readOnlyFields,
    ...(generated.mobileChangeViaOtp === true ? { mobileChangeViaOtp: true } : {}),
    ...(generated.sections !== undefined ? { sections: generated.sections } : {}),
    validators: attachValidators(generated.editableFields),
  });
}
