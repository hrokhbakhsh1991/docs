/**
 * Wire JSON for `GET/PATCH /api/v2/me` (snake_case, matches OpenAPI schemas).
 */

export const ME_PROFILE_GENDER_VALUES = ["female", "male", "non_binary", "prefer_not_to_say"] as const;

export type MeProfileGenderWire = (typeof ME_PROFILE_GENDER_VALUES)[number];

export interface MeProfileWire {
  id: string;
  full_name?: string | null;
  national_id?: string | null;
  gender?: MeProfileGenderWire | null;
  birth_date?: string | null;
  /** Contact email when set; omitted or `null` for phone-first accounts without an address on file. */
  email?: string | null;
  is_email_verified?: boolean;
  phone?: string | null;
  is_phone_verified?: boolean;
  /** Mirrors `users.notifications_enabled` — `null` when never set at rest. */
  notifications_enabled?: boolean | null;
  /** Optimistic concurrency token (paired with weak `ETag` / optional `If-Match` on PATCH). */
  profile_row_version: number;
}

export type MePendingEmailVerificationWire = {
  status: "pending_email_verification";
  profile_row_version: number;
};

export type MePatchSuccessWire = MeProfileWire | MePendingEmailVerificationWire;

export type MeEmailVerifiedWire = {
  status: "email_verified";
  email: string;
};

export type MeChangeMobileChallengeWire = {
  challenge_id: string;
};

export type MeMobileChangedWire = {
  status: "mobile_changed";
  mobile: string;
};
