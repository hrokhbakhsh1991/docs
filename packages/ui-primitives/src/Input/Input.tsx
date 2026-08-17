import { forwardRef, useId, type InputHTMLAttributes } from "react";

import type { SemanticCssVariable } from "@app-tour/design-tokens";

import type { PrimitiveColorToken } from "../utils/design-token-types";
import { cn } from "../utils/cn";
import styles from "./Input.module.css";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id?: string;
  /** When true, applies invalid border token (--color-danger). */
  invalid?: boolean;
};

export type InputSurfaceToken = Extract<SemanticCssVariable, "--color-surface" | "--color-border">;
export type InputInvalidBorderToken = Extract<PrimitiveColorToken, "--color-danger">;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id: idProp, invalid, className, "aria-invalid": ariaInvalid, ...rest },
  ref,
) {
  const reactId = useId();
  const fieldId = idProp ?? `input-${reactId.replace(/:/g, "")}`;
  const isInvalid = invalid === true || ariaInvalid === true;

  return (
    <input
      {...rest}
      ref={ref}
      id={fieldId}
      className={cn(styles.control, isInvalid && styles.controlInvalid, className)}
      aria-invalid={isInvalid || undefined}
    />
  );
});
