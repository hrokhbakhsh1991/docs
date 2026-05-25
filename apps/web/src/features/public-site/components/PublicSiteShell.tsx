"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { usePublicSiteConfig } from "@/features/public-site/context/public-site-config-context";

import styles from "./PublicSiteShell.module.css";

export function PublicSiteShell({ children }: { children: ReactNode }) {
  const config = usePublicSiteConfig();
  const brand =
    config.pages.landing.sections[0]?.title ??
    config.pages.landing.route.title ??
    config.contentWorkspace;

  return (
    <div className={styles.shell} data-content-workspace={config.contentWorkspace}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          {brand}
          <span className={styles.badge} data-tour-profile={config.tourFormProfile}>
            {config.wizard.wizardMode}
          </span>
        </Link>
        <nav aria-label="Public site">
          <ul className={styles.nav}>
            {config.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.navLink}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        Workspace: {config.contentWorkspace} · Profile: {config.tourFormProfile}
      </footer>
    </div>
  );
}
