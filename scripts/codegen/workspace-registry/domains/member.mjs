import { BANNER } from "../constants.mjs";

const MEMBER_PROFILE_FIELD_IDS = new Set([
  "displayName",
  "mobile",
  "email",
  "nationalId",
  "fatherName",
  "birthDate",
  "gender",
  "avatarUrl",
]);

/**
 * @param {ReturnType<typeof discoverManifests>[number]} manifest
 */
export function assertMemberProfileManifest(manifest) {
  const profile = manifest.memberProfile;
  if (profile === undefined) {
    return;
  }
  if (typeof profile !== "object") {
    throw new Error(`${manifest.id}: memberProfile must be an object`);
  }
  for (const key of ["editableFields", "readOnlyFields"]) {
    const fields = profile[key];
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error(`${manifest.id}: memberProfile.${key} must be a non-empty string array`);
    }
    for (const fieldId of fields) {
      if (typeof fieldId !== "string" || !MEMBER_PROFILE_FIELD_IDS.has(fieldId)) {
        throw new Error(`${manifest.id}: memberProfile.${key} contains invalid field "${fieldId}"`);
      }
    }
  }
  const editable = new Set(profile.editableFields);
  for (const fieldId of profile.readOnlyFields) {
    if (editable.has(fieldId)) {
      throw new Error(`${manifest.id}: memberProfile field "${fieldId}" cannot be both editable and readOnly`);
    }
  }
  if (profile.sections !== undefined) {
    if (!Array.isArray(profile.sections)) {
      throw new Error(`${manifest.id}: memberProfile.sections must be an array`);
    }
    const exposed = new Set([...profile.editableFields, ...profile.readOnlyFields]);
    for (const section of profile.sections) {
      if (typeof section?.id !== "string" || section.id.length === 0) {
        throw new Error(`${manifest.id}: memberProfile.sections[].id is required`);
      }
      if (!Array.isArray(section.fields) || section.fields.length === 0) {
        throw new Error(`${manifest.id}: memberProfile.sections[${section.id}].fields is required`);
      }
      for (const fieldId of section.fields) {
        if (!exposed.has(fieldId)) {
          throw new Error(
            `${manifest.id}: memberProfile.sections[${section.id}] references unknown field "${fieldId}"`
          );
        }
      }
    }
  }
}


/** @param {ReturnType<typeof discoverManifests>} manifests */
export function generateWorkspaceMemberProfileCapabilities(manifests) {
  /** @type {Record<string, object>} */
  const capabilities = {};
  for (const manifest of manifests) {
    assertMemberProfileManifest(manifest);
    if (manifest.memberProfile === undefined) {
      continue;
    }
    const profile = manifest.memberProfile;
    const sectionBlocks =
      profile.sections === undefined
        ? ""
        : profile.sections
            .map(
              (section) => `      Object.freeze({
        id: ${JSON.stringify(section.id)},
        fields: Object.freeze(${JSON.stringify(section.fields)} as const satisfies readonly MemberProfileFieldId[]),
      }),`
            )
            .join("\n");
    const sectionsEmit =
      profile.sections === undefined
        ? ""
        : `,
    sections: Object.freeze([
${sectionBlocks}
    ])`;
    const mobileChangeEmit =
      profile.mobileChangeViaOtp === true ? `,
    mobileChangeViaOtp: true` : "";
    capabilities[manifest.id] = `  ${JSON.stringify(manifest.id)}: Object.freeze({
    editableFields: Object.freeze(${JSON.stringify(profile.editableFields)} as const satisfies readonly MemberProfileFieldId[]),
    readOnlyFields: Object.freeze(${JSON.stringify(profile.readOnlyFields)} as const satisfies readonly MemberProfileFieldId[])${sectionsEmit}${mobileChangeEmit}
  }),`;
  }

  const entries = Object.values(capabilities).join("\n");

  return `${BANNER}
import type { MemberProfileFieldId } from "./member-profile-field-id";

export type GeneratedMemberProfileCapabilities = Readonly<{
  readonly editableFields: readonly MemberProfileFieldId[];
  readonly readOnlyFields: readonly MemberProfileFieldId[];
  readonly mobileChangeViaOtp?: boolean;
  readonly sections?: readonly Readonly<{
    readonly id: string;
    readonly fields: readonly MemberProfileFieldId[];
  }>[];
}>;

/** Portal member profile capability rows — derived from workspace.manifest.json memberProfile. */
export const WORKSPACE_MEMBER_PROFILE_CAPABILITIES: Readonly<
  Record<string, GeneratedMemberProfileCapabilities>
> = Object.freeze({
${entries}
});
`;
}
