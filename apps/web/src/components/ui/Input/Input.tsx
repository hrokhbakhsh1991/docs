"use client";

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "../cn";
import styles from "./Input.module.css";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  /** Defaults to generated id when omitted */
  id?: string;
  label: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  /** When true, renders asterisk in label */
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
  const uid = useId();
  const id = idProp ?? uid;
  const invalid = Boolean(error) || ariaInvalid === true;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {requiredIndicator ? (
          <span className={styles.requiredMark} aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <input
        ref={ref}
        id={id}
        className={cn(styles.control, invalid && styles.controlInvalid, className)}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [helperText ? `${id}-help` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") ||
          undefined
        }
        {...rest}
      />
      {helperText ? (
        <p className={styles.help} id={`${id}-help`}>
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={`${id}-err`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
