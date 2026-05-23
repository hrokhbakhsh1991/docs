"use client";

import styles from "../users-page.module.css";

export type DirectoryTabId = "active" | "pending";

type DirectoryTabsProps = {
  activeTab: DirectoryTabId;
  onTabChange: (tab: DirectoryTabId) => void;
  activeLabel: string;
  pendingLabel: string;
  disabled?: boolean;
};

export function DirectoryTabs({
  activeTab,
  onTabChange,
  activeLabel,
  pendingLabel,
  disabled = false
}: DirectoryTabsProps): JSX.Element {
  return (
    <div role="tablist" className={styles.directoryMasterTabs} dir="rtl">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "active"}
        className={
          activeTab === "active"
            ? `${styles.directoryMasterTab} ${styles.directoryMasterTabActive}`
            : styles.directoryMasterTab
        }
        disabled={disabled}
        onClick={() => onTabChange("active")}
      >
        {activeLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "pending"}
        className={
          activeTab === "pending"
            ? `${styles.directoryMasterTab} ${styles.directoryMasterTabActive}`
            : styles.directoryMasterTab
        }
        disabled={disabled}
        onClick={() => onTabChange("pending")}
      >
        {pendingLabel}
      </button>
    </div>
  );
}
