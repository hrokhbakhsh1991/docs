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

function resolveHomeQuickLinkDescriptionKey(id: string): string {
  if (id === "profile" || id === "trips") {
    return `linkDescriptions.${id}`;
  }
  return "linkDescriptions.default";
}

export function MemberHomeQuickLinks({ items }: MemberHomeQuickLinksProps) {
  const t = useTranslations("portalMember.nav");
  const tHome = useTranslations("portalMember.home");

  if (items.length === 0) {
    return null;
  }

  return (
    <ul
      data-portal-member-home-quick-links
      data-portal-member-home-card-count={String(items.length)}
    >
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} data-testid={item.testId}>
            <span data-portal-member-home-quick-link-top>
              <span data-portal-member-home-quick-link-arrow aria-hidden="true">
                ↗
              </span>
              <span data-portal-member-home-quick-link-icon>
                <PortalNavIcon moduleId={item.id} />
              </span>
            </span>
            {item.id === items[0]?.id ? (
              <span data-portal-member-home-quick-link-badge>
                {tHome("quickLinksRecommended")}
              </span>
            ) : null}
            <span data-portal-member-home-quick-link-label>{t(item.labelKey)}</span>
            <span data-portal-member-home-quick-link-description>
              {tHome(resolveHomeQuickLinkDescriptionKey(item.id))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
