import type { MembershipStatus } from "../membership-status.enum";

/** Raw row from tenant-scoped user + membership join (persistence shape). */
export type TenantScopedUserRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  role: string;
  membership_status: MembershipStatus;
  profile_row_version?: number;
  last_login_at?: Date | null;
  invited_at?: Date | null;
  joined_at?: Date | null;
  suspended_at?: Date | null;
  labels?: unknown;
  membership_metadata?: unknown;
  telegram_linked?: boolean | string | null;
};
