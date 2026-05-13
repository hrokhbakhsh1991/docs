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
  /**
   * Soft "recommended" tier label rendered as a non-blocking badge next to `label`.
   *
   * Semantics (matches the wizard's `FieldRequiredness === "recommended"` tier, see
   * `apps/web/src/features/tours/wizard/profileRules/types.ts`):
   *
   * - Pure UI affordance — does **not** set `required` / `aria-required` on the control;
   *   form submission and step navigation are unaffected.
   * - Only rendered when `required` is falsy. A `"required"` field never simultaneously
   *   displays a "recommended" badge — required wins.
   * - The caller supplies the translated text (e.g. `"پیشنهادی"` / `"Recommended"`); the
   *   primitive only styles + positions the marker. The badge is added to the visible
   *   label and to `aria-describedby` so assistive tech can announce it.
   */
  recommendedLabel?: ReactNode;
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
  recommendedLabel,
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
  const recommendedId = `${fieldId}-rec`;
  const invalid = Boolean(error);
  const hint = description ?? helperText;
  // `"recommended"` is mutually exclusive with `"required"` — a required field never
  // simultaneously displays the recommended badge, matching the rules-layer semantics.
  const showRecommended = !required && recommendedLabel != null && recommendedLabel !== false;

  const describedByParts = [
    typeof children.props["aria-describedby"] === "string"
      ? (children.props["aria-describedby"] as string)
      : "",
    showRecommended ? recommendedId : "",
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
          {showRecommended ? (
            <span
              id={recommendedId}
              className={styles.recommendedMark}
              data-testid="form-field-recommended"
            >
              {recommendedLabel}
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
