"use client";

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "../../utils/cn";
import styles from "../Checkbox/Checkbox.module.css";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  /** Control only — pair with wrapping `FormField` for label/help text */
  bare?: boolean;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, bare, className, disabled, id: idProp, ...rest },
  ref,
) {
  const reactId = useId();
  const fieldId = idProp ?? `cb-${reactId.replace(/:/g, "")}`;

  if (bare) {
    return (
      <input
        ref={ref}
        type="checkbox"
        id={fieldId}
        disabled={disabled}
        className={cn(styles.inputPlain, className)}
        {...rest}
      />
    );
  }

  return (
    <label className={cn(styles.root, disabled && styles.rootDisabled, className)} htmlFor={fieldId}>
      <input ref={ref} type="checkbox" id={fieldId} disabled={disabled} className={styles.input} {...rest} />
      {label ? <span className={styles.text}>{label}</span> : null}
    </label>
  );
});
