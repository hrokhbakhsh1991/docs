import { forwardRef, useId, type InputHTMLAttributes } from "react";

import { cn } from "../utils/cn";
import styles from "./Checkbox.module.css";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  id?: string;
  readonly invalid?: boolean;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { id: idProp, invalid, className, "aria-invalid": ariaInvalid, ...rest },
  ref,
) {
  const reactId = useId();
  const fieldId = idProp ?? `checkbox-${reactId.replace(/:/g, "")}`;
  const isInvalid = invalid === true || ariaInvalid === true;

  return (
    <input
      ref={ref}
      id={fieldId}
      type="checkbox"
      className={cn(styles.control, isInvalid && styles.controlInvalid, className)}
      aria-invalid={isInvalid || undefined}
      {...rest}
    />
  );
});
