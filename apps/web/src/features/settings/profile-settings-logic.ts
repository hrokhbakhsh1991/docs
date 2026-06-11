export type OperatorProfile = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: string;
  readonly status: string;
  readonly workspaceId: string | null;
  readonly mobile: string;
  readonly displayName: string;
};

export function resolveProfileDisplayName(profile: Pick<OperatorProfile, "displayName" | "mobile">): string {
  const trimmed = profile.displayName.trim();
  return trimmed.length > 0 ? trimmed : profile.mobile;
}

export function isProfileDisplayNameValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 80;
}
