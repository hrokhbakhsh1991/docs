import type { MemberProfileCapabilities, MemberProfileFieldId } from "@app-tour/workspace-sdk";

export type { MemberProfileFieldId };

export type SerializableMemberProfileCapabilities = {
  readonly editableFields: readonly MemberProfileFieldId[];
  readonly readOnlyFields: readonly MemberProfileFieldId[];
  readonly mobileChangeViaOtp?: boolean;
  readonly sections?: MemberProfileCapabilities["sections"];
};

export type MemberProfileViewProfile = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: string;
  readonly fields: Readonly<Partial<Record<MemberProfileFieldId, string | null>>>;
  readonly capabilities: SerializableMemberProfileCapabilities;
};

export type MemberProfileViewPayload = {
  readonly ok: true;
  readonly contractVersion: "v1";
  readonly profile: MemberProfileViewProfile;
};

export type MemberProfileFetchResult =
  | { readonly status: "ok"; readonly payload: MemberProfileViewPayload }
  | { readonly status: "missing_cookie" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "unavailable" };

export type MemberProfileApiErrorPayload = {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly fieldErrors?: Partial<Record<MemberProfileFieldId, string>>;
  };
};
