"use client";

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "../../utils/cn";
import styles from "../Radio/Radio.module.css";

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
};

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, className, disabled, id: idProp, ...rest },
  ref,
) {
  const reactId = useId();
  const fieldId = idProp ?? `rad-${reactId.replace(/:/g, "")}`;

  return (
    <label className={cn(styles.root, disabled && styles.rootDisabled, className)} htmlFor={fieldId}>
      <input ref={ref} type="radio" id={fieldId} disabled={disabled} className={styles.input} {...rest} />
      {label ? <span className={styles.text}>{label}</span> : null}
    </label>
  );
});
