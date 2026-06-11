"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import { USERS_DIRECTORY_TEST_IDS } from "@/features/users/users-directory-types";

export function UsersDirectoryLockedPanel() {
  const t = useTranslations("users.locked");
  return (
    <Card data-testid={USERS_DIRECTORY_TEST_IDS.locked}>
      <CardContent className="py-12 text-center text-muted-foreground">
        <p className="font-medium">{t("title")}</p>
        <p className="mt-2 text-sm">{t("detail")}</p>
      </CardContent>
    </Card>
  );
}
