"use client";

import { Input as PrimitiveInput } from "@app-tour/ui-primitives/input";
import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";
import {
  useLocalizedNumericInput,
  type UseLocalizedNumericInputOptions,
} from "@/i18n/use-localized-numeric-input";

type PrimitiveLocalizedNumericInputProps = Omit<
  ComponentProps<typeof PrimitiveInput>,
  "type" | "value" | "onChange" | "inputMode" | "dir"
> &
  UseLocalizedNumericInputOptions;

export function PrimitiveLocalizedNumericInput({
  value,
  onChange,
  mode,
  maxLength,
  className,
  ...rest
}: PrimitiveLocalizedNumericInputProps) {
  const localized = useLocalizedNumericInput({ value, onChange, mode, maxLength });
  return (
    <PrimitiveInput
      {...rest}
      {...localized}
      className={cn(localized.className, className)}
    />
  );
}
