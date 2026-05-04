"use client";

import {
  cloneElement,
  isValidElement,
  useId,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "../../utils/cn";
import styles from "../FormField/FormField.module.css";

export type FormFieldProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: ReactNode;
  /** Helper copy below the control */
  description?: ReactNode;
  /** @deprecated Prefer `description` */
  helperText?: ReactNode;
  children: ReactElement<Record<string, unknown>>;
};

export function FormField({
  label,
  htmlFor,
  required,
  error,
  description,
  helperText,
  children,
  className,
  ...rest
}: FormFieldProps) {
  if (!isValidElement(children)) {
    throw new Error("FormField expects a single valid React element as child.");
  }

  const reactId = useId();
  const generatedId = `ff-${reactId.replace(/:/g, "")}`;
  const fieldId = htmlFor ?? (children.props.id as string | undefined) ?? generatedId;
  const helpId = `${fieldId}-help`;
  const errId = `${fieldId}-err`;
  const invalid = Boolean(error);
  const hint = description ?? helperText;

  const describedByParts = [
    typeof children.props["aria-describedby"] === "string"
      ? (children.props["aria-describedby"] as string)
      : "",
    hint ? helpId : "",
    error ? errId : "",
  ].filter(Boolean);
  const describedBy = describedByParts.length > 0 ? describedByParts.join(" ") : undefined;

  const control = cloneElement(children as ReactElement<Record<string, unknown>>, {
    id: fieldId,
    className: cn(children.props.className as string | undefined),
    "aria-invalid": invalid ? true : children.props["aria-invalid"],
    "aria-describedby": describedBy,
    "aria-required": required ? true : children.props["aria-required"],
    ...(required ? { required: true as const } : {}),
  });

  return (
    <div className={cn(styles.field, className)} {...rest}>
      {label != null ? (
        <label className={styles.label} htmlFor={fieldId}>
          {label}
          {required ? (
            <span className={styles.requiredMark} aria-hidden>
              *
            </span>
          ) : null}
        </label>
      ) : null}
      <div className={styles.controlSlot}>{control}</div>
      {hint ? (
        <p className={styles.help} id={helpId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
