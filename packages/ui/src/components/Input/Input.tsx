"use client";

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";
import styles from "./Input.module.css";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id?: string;
  /** Omit label (and inline helper/error) when composing with `FormField` */
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  requiredIndicator?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id: idProp,
    label,
    helperText,
    error,
    requiredIndicator,
    className,
    disabled,
    readOnly,
    "aria-invalid": ariaInvalid,
    ...rest
  },
  ref
) {
  const reactId = useId();
  const fieldId = idProp ?? `in-${reactId.replace(/:/g, "")}`;
  const invalid = Boolean(error) || ariaInvalid === true;

  const describedby =
    label != null
      ? [helperText ? `${fieldId}-help` : "", error ? `${fieldId}-err` : ""].filter(Boolean).join(" ") ||
        undefined
      : undefined;

  const controlProps = {
    id: fieldId,
    className: cn(styles.control, invalid && styles.controlInvalid, className),
    disabled,
    readOnly,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedby,
    ...rest,
  };

  if (label == null) {
    return <input ref={ref} {...controlProps} />;
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
        {requiredIndicator ? (
          <span className={styles.requiredMark} aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <input ref={ref} {...controlProps} />
      {helperText ? (
        <p className={styles.help} id={`${fieldId}-help`}>
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={`${fieldId}-err`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
