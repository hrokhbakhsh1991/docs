import { forwardRef, useId, type SelectHTMLAttributes } from "react";

import { cn } from "../utils/cn";
import styles from "./Select.module.css";

export type SelectOption = {
  readonly value: string;
  readonly label: string;
};

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id" | "children" | "value" | "defaultValue"
> & {
  id?: string;
  readonly options: readonly SelectOption[];
  readonly value?: string;
  readonly invalid?: boolean;
  readonly placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    id: idProp,
    options,
    value = "",
    invalid,
    placeholder,
    className,
    "aria-invalid": ariaInvalid,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const fieldId = idProp ?? `select-${reactId.replace(/:/g, "")}`;
  const isInvalid = invalid === true || ariaInvalid === true;

  return (
    <select
      ref={ref}
      id={fieldId}
      className={cn(styles.control, isInvalid && styles.controlInvalid, className)}
      value={value}
      aria-invalid={isInvalid || undefined}
      {...rest}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});
