"use client";

import { useTranslations } from "next-intl";

import type { OperatorNavItem } from "./operator-nav.types";
import { OperatorNav } from "./operator-nav";
import styles from "./operator-drawer.module.css";

type OperatorDrawerProps = {
  readonly open: boolean;
  readonly items: readonly OperatorNavItem[];
  readonly workspaceLabel: string;
  readonly pluginId: string;
  readonly onClose: () => void;
};

export function OperatorDrawer({ open, items, workspaceLabel, pluginId, onClose }: OperatorDrawerProps) {
  const t = useTranslations("app");

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={styles.backdrop}
        aria-label={t("closeMenu")}
        onClick={onClose}
      />
      <aside id="operator-drawer" className={styles.panel} aria-label={t("mobileNav")}>
        <OperatorNav
          items={items}
          workspaceLabel={workspaceLabel}
          pluginId={pluginId}
          onNavigate={onClose}
        />
      </aside>
    </>
  );
}
