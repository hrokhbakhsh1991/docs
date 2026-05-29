import type { MembershipStatus } from "../membership-status.enum";

/** Cursor segment for keyset pagination (membership `created_at` + membership `id`). */
export type TenantUsersListCursor = { createdAt: string; id: string } | null;

/** Filter bundle for directory listing (caller resolves tenant + cursor decode). */
export type TenantUsersListQuery = {
  tenantId: string;
  limit: number;
  normalizedSearch: string;
  roleFilter?: string;
  statusFilter?: string;
  lastLoginFrom?: string;
  lastLoginTo?: string;
  cursor: TenantUsersListCursor;
};

export type TenantUsersListRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  last_login_at: Date | null;
  last_active_at: Date | null;
  gender: string | null;
  profile_image_url: string | null;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  membership_id: string;
  membership_created_at: Date;
  role: string;
  membership_status: MembershipStatus;
  invited_at: Date | null;
  joined_at: Date | null;
  suspended_at: Date | null;
  labels: unknown;
  membership_metadata: unknown;
  telegram_linked: boolean | string;
  profile_row_version: number | null;
};
