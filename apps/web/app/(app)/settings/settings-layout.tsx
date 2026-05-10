"use client";

import type { ReactNode } from "react";

import styles from "./settings-layout.module.css";

export type SettingsLayoutProps = {
  children: ReactNode;
};

/**
 * Wraps settings sections in a centered column with consistent vertical rhythm.
 */
export function SettingsLayout({ children }: SettingsLayoutProps) {
  return <div className={styles.root}>{children}</div>;
}
