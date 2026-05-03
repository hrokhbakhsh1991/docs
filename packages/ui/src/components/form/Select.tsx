"use client";

import { forwardRef } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";

import { cn } from "../../utils/cn";
import styles from "../Select/Select.module.css";

function Chevron() {
  return (
    <span className={styles.chevron} aria-hidden>
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  children: ReactNode;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, disabled, invalid, children, "aria-invalid": ariaInvalid, ...rest },
  ref,
) {
  const selInvalid = Boolean(invalid) || ariaInvalid === true;

  return (
    <div className={styles.wrap}>
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={selInvalid || undefined}
        className={cn(styles.control, selInvalid && styles.controlInvalid, className)}
        {...rest}
      >
        {children}
      </select>
      <Chevron />
    </div>
  );
});
