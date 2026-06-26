"use client";

import { OperatorProfileAvatar } from "@/admin/patterns/operator-profile-avatar";
import {
  USERS_DIRECTORY_TEST_IDS,
  type UsersDirectoryRow,
} from "@/features/users/users-directory-types";

type UsersDirectoryAvatarProps = {
  readonly user: Pick<UsersDirectoryRow, "userId" | "displayName" | "avatarUrl">;
  readonly className?: string;
};

export function UsersDirectoryAvatar({ user, className }: UsersDirectoryAvatarProps) {
  return (
    <OperatorProfileAvatar
      userId={user.userId}
      displayName={user.displayName}
      avatarUrl={user.avatarUrl ?? null}
      className={className}
      fallbackClassName="text-muted-foreground"
      fallbackMode="icon"
      testId={USERS_DIRECTORY_TEST_IDS.rowAvatar}
    />
  );
}
