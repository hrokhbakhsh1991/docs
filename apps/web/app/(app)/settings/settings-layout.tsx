"use client";

import type { ReactNode } from "react";

import styles from "./settings-layout.module.css";

export type SettingsLayoutProps = {
  children: ReactNode;
  /** Use on tour-wizard-template builder (config + live preview). */
  wide?: boolean;
};

/**
 * Wraps settings sections in a centered column with consistent vertical rhythm.
 */
export function SettingsLayout({ children, wide = false }: SettingsLayoutProps) {
  return <div className={wide ? `${styles.root} ${styles.rootWide}` : styles.root}>{children}</div>;
}
