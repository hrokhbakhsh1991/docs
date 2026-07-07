export function leaderDisplayInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export const DENALI_LEADER_CHIP_PREVIEW_LIMIT = 3;

export type DenaliLeaderPickerUser = {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl?: string | null;
};

export function hasLeaderPickerAvatarUrl(
  avatarUrl: string | null | undefined
): avatarUrl is string {
  return typeof avatarUrl === "string" && avatarUrl.trim().length > 0;
}

/** Picker stays open when empty; collapses to chip summary once leaders are chosen. */
export function resolveDenaliLeaderPickerDefaultExpanded(selectedCount: number): boolean {
  return selectedCount === 0;
}

export function partitionLeaderChipPreview(
  selectedUsers: readonly DenaliLeaderPickerUser[],
  limit: number = DENALI_LEADER_CHIP_PREVIEW_LIMIT
): { readonly visible: readonly DenaliLeaderPickerUser[]; readonly overflowCount: number } {
  if (selectedUsers.length <= limit) {
    return { visible: selectedUsers, overflowCount: 0 };
  }
  return {
    visible: selectedUsers.slice(0, limit),
    overflowCount: selectedUsers.length - limit,
  };
}

export function truncateLeaderDisplayName(name: string, maxLength: number = 18): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(1, maxLength - 1))}…`;
}
