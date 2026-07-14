"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { PortalNavIcon } from "@/shell/portal-nav-icon";

export type MemberHomeQuickLinkItem = Readonly<{
  id: string;
  href: string;
  labelKey: string;
  testId?: string;
}>;

export type MemberHomeQuickLinksProps = {
  readonly items: readonly MemberHomeQuickLinkItem[];
};

export function MemberHomeQuickLinks({ items }: MemberHomeQuickLinksProps) {
  const t = useTranslations("portalMember.nav");

  if (items.length === 0) {
    return null;
  }

  return (
    <ul data-portal-member-home-quick-links>
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} data-testid={item.testId}>
            <span data-portal-member-home-quick-link-icon>
              <PortalNavIcon moduleId={item.id} />
            </span>
            <span data-portal-member-home-quick-link-label>{t(item.labelKey)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
