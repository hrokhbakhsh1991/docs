"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { PortalNavIcon } from "@/shell/portal-nav-icon";

export type MemberHubLinkItem = Readonly<{
  id: string;
  href: string;
  labelKey: string;
  testId?: string;
}>;

export type MemberMoreHubListProps = {
  readonly mode: string;
  readonly items: readonly MemberHubLinkItem[];
};

export function MemberMoreHubList({ mode, items }: MemberMoreHubListProps) {
  const t = useTranslations("portalMember.nav");
  const hubT = useTranslations("portalMember.hub");

  return (
    <ul
      data-portal-member-hub-list
      data-portal-member-hub-mode={mode}
      data-portal-member-hub-card-count={String(items.length)}
    >
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} data-portal-member-hub-link data-testid={item.testId}>
            <span data-portal-member-hub-link-icon>
              <PortalNavIcon moduleId={item.id} />
            </span>
            <span data-portal-member-hub-link-copy>
              <span data-portal-member-hub-link-label>{t(item.labelKey)}</span>
              <span data-portal-member-hub-link-description>
                {hubT.has(`linkDescriptions.${item.id}`)
                  ? hubT(`linkDescriptions.${item.id}`)
                  : hubT("linkDescriptions.default")}
              </span>
            </span>
            <span data-portal-member-hub-link-chevron aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
