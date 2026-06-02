/** HTTP shape for `GET/PATCH /api/v2/me` profile branch (snake_case). */
export type MeProfileResponse = {
  id: string;
  full_name: string | null;
  national_id: string | null;
  gender: string | null;
  birth_date: string | null;
  /** Contact email when set; `null` for phone-first accounts without an address on file. */
  email: string | null;
  is_email_verified: boolean;
  phone: string | null;
  is_phone_verified: boolean;
  /** `null` = never opted in/out at rest; mirrors `users.notifications_enabled`. */
  notifications_enabled: boolean | null;
  /** Optimistic concurrency token (weak `ETag` / optional `If-Match`). */
  profile_row_version: number;
};

export type PendingEmailVerificationResponse = {
  status: "pending_email_verification";
  profile_row_version: number;
};

export type EmailVerifiedResponse = {
  status: "email_verified";
  email: string;
};

export type MobileChangedResponse = {
  status: "mobile_changed";
  mobile: string;
};

export type SelfPiiSnapshot = {
  full_name: string | null;
  national_id: string | null;
  gender: string | null;
  birth_date: string | null;
};
