"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@tour/ui";

import { TOUR_WORKSPACE_COPY } from "./tour-workspace-copy";
import {
  resolveWorkspaceSubnavTab,
  type WorkspaceSubnavTab,
} from "./workspaceSubnavUtils";

export type { WorkspaceSubnavTab };
export { resolveWorkspaceSubnavTab };

import styles from "./workspace-subnav.module.css";

export type WorkspaceSubnavProps = {
  tourId: string;
};

function workspaceBasePath(tourId: string): string {
  return `/tours/${encodeURIComponent(tourId)}/workspace`;
}

export function WorkspaceSubnav({ tourId }: WorkspaceSubnavProps) {
  const pathname = usePathname() ?? "";
  const active = resolveWorkspaceSubnavTab(pathname, tourId);
  const base = workspaceBasePath(tourId);
  const copy = TOUR_WORKSPACE_COPY.subnav;

  const tabs: { tab: WorkspaceSubnavTab; href: string; label: string }[] = [
    { tab: "registrations", href: base, label: copy.registrations },
    { tab: "waitlist", href: `${base}/waitlist`, label: copy.waitlist },
    { tab: "transport", href: `${base}/transport`, label: copy.transport },
  ];

  return (
    <nav className={styles.root} aria-label={copy.ariaLabel} data-testid="tour-workspace-subnav">
      {tabs.map(({ tab, href, label }) => (
        <Link
          key={tab}
          href={href}
          prefetch={false}
          className={cn(styles.link, active === tab && styles.linkActive)}
          aria-current={active === tab ? "page" : undefined}
          data-testid={`tour-workspace-tab-${tab}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
