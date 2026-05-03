"use client";

import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

import { cn } from "../../utils/cn";
import styles from "../Textarea/Textarea.module.css";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, disabled, readOnly, invalid, "aria-invalid": ariaInvalid, ...rest },
  ref,
) {
  const selInvalid = Boolean(invalid) || ariaInvalid === true;

  return (
    <textarea
      ref={ref}
      disabled={disabled}
      readOnly={readOnly}
      aria-invalid={selInvalid || undefined}
      className={cn(styles.control, selInvalid && styles.controlInvalid, className)}
      {...rest}
    />
  );
});
