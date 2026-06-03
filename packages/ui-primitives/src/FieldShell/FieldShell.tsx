import { cloneElement, forwardRef, isValidElement, useId, type HTMLAttributes, type ReactElement, type ReactNode } from "react";

import type { PrimitiveColorToken, PrimitiveSpacing } from "../utils/design-token-types";
import { cn } from "../utils/cn";
import styles from "./FieldShell.module.css";

export type FieldShellProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  label: ReactNode;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
  helperText?: ReactNode;
  error?: ReactNode;
  required?: boolean;
};

/** Tokens applied in FieldShell.module.css (see fieldShellTokens). */
export type FieldShellLabelColor = Extract<PrimitiveColorToken, "--color-text-primary">;
export type FieldShellHelpColor = Extract<PrimitiveColorToken, "--color-text-secondary">;
export type FieldShellErrorColor = Extract<PrimitiveColorToken, "--color-danger">;
export type FieldShellGap = Extract<PrimitiveSpacing, "--space-2">;

export const FieldShell = forwardRef<HTMLDivElement, FieldShellProps>(function FieldShell(
  { label, children, helperText, error, required = false, className, ...rest },
  ref,
) {
  if (!isValidElement(children)) {
    throw new Error("FieldShell: children must be a single React element");
  }

  const reactId = useId();
  const baseId = `field-${reactId.replace(/:/g, "")}`;
  const controlId = children.props.id ?? baseId;
  const helpId = helperText ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-err` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const invalid = Boolean(error);

  const control = cloneElement(children, {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || children.props["aria-invalid"],
  });

  return (
    <div ref={ref} className={cn(styles.field, className)} {...rest}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
        {required ? (
          <span className={styles.requiredMark} aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      {control}
      {helperText ? (
        <p className={styles.help} id={helpId}>
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
