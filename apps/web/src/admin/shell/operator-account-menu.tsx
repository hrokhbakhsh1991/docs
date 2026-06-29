"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { OperatorProfileAvatar } from "@/admin/patterns/operator-profile-avatar";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { OPERATOR_NAV_TEST_IDS } from "./operator-nav.types";
import { useTenantBrandTitle } from "@/tenant/tenant-branding-context";

type OperatorAccountMenuProps = {
  readonly session: OperatorSessionContext;
  readonly displayName?: string | null;
  readonly avatarUrl?: string | null;
  readonly onLogout: () => void;
};

export function OperatorAccountMenu({
  session,
  displayName = null,
  avatarUrl = null,
  onLogout,
}: OperatorAccountMenuProps) {
  const tApp = useTranslations("app");
  const brandTitle = useTenantBrandTitle();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          data-testid={OPERATOR_NAV_TEST_IDS.accountMenu}
          aria-label={tApp("accountMenu")}
        >
          <OperatorProfileAvatar
            userId={session.userId}
            displayName={displayName}
            avatarUrl={avatarUrl}
            className="h-8 w-8"
            fallbackClassName="text-xs"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <div className="text-xs text-muted-foreground">
            {tApp("roleLabel", { role: session.role })}
          </div>
          <div className="text-xs text-muted-foreground">
            {tApp("workspaceLabel", { workspace: brandTitle || session.workspaceType })}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/me">{tApp("profile")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLogout}>{tApp("logout")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
