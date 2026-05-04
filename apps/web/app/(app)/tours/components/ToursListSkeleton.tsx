"use client";

import gridStyles from "./tour-list-grid.module.css";
import styles from "./ToursListSkeleton.module.css";

export type ToursListSkeletonProps = {
  /** Number of skeleton cards (grid rows). */
  count?: number;
};

export function ToursListSkeleton({ count = 6 }: ToursListSkeletonProps) {
  return (
    <ul className={gridStyles.grid} aria-busy="true" aria-label="Loading tours">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={styles.cell}>
          <div className={styles.card}>
            <div className={`${styles.line} ${styles.lineLg}`} />
            <div className={`${styles.line} ${styles.lineSm}`} />
            <div className={styles.blockStack}>
              <div className={`${styles.line} ${styles.lineMd}`} />
              <div className={`${styles.line} ${styles.lineMd}`} />
              <div className={`${styles.line} ${styles.lineMd}`} />
            </div>
            <div className={styles.footer}>
              <div className={styles.pill} />
              <div className={`${styles.pill} ${styles.pillWide}`} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
