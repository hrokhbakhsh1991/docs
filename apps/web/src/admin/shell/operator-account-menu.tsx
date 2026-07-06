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
          data-operator-account-menu-trigger
          data-testid={OPERATOR_NAV_TEST_IDS.accountMenu}
          aria-label={tApp("accountMenu")}
        >
          <span data-operator-account-menu-avatar>
            <OperatorProfileAvatar
              userId={session.userId}
              displayName={displayName}
              avatarUrl={avatarUrl}
              shellChrome="account-menu"
            />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-operator-account-menu-panel>
        <DropdownMenuLabel data-operator-account-menu-label>
          <div data-operator-account-menu-meta>
            {tApp("roleLabel", { role: session.role })}
          </div>
          <div data-operator-account-menu-meta>
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
