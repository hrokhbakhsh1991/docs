"use client";

import { Input as PrimitiveInput } from "@app-tour/ui-primitives/input";
import React, { forwardRef, type ComponentProps } from "react";

import { Input as ShadcnInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useLocalizedNumericInput,
  type UseLocalizedNumericInputOptions,
} from "@/i18n/use-localized-numeric-input";

type LocalizedNumericInputBaseProps = Omit<
  ComponentProps<typeof ShadcnInput>,
  "type" | "value" | "onChange" | "inputMode" | "dir"
> &
  UseLocalizedNumericInputOptions;

export function LocalizedNumericInput({
  value,
  onChange,
  mode,
  maxLength,
  groupThousands,
  className,
  ...rest
}: LocalizedNumericInputBaseProps) {
  const localized = useLocalizedNumericInput({ value, onChange, mode, maxLength, groupThousands });
  return <ShadcnInput {...rest} {...localized} className={cn(localized.className, className)} />;
}

type PrimitiveLocalizedNumericInputProps = Omit<
  ComponentProps<typeof PrimitiveInput>,
  "type" | "value" | "onChange" | "inputMode" | "dir"
> &
  UseLocalizedNumericInputOptions;

export const PrimitiveLocalizedNumericInput = forwardRef<
  HTMLInputElement,
  PrimitiveLocalizedNumericInputProps
>(function PrimitiveLocalizedNumericInput(
  { value, onChange, mode, maxLength, groupThousands, className, ...rest },
  ref
) {
  const localized = useLocalizedNumericInput({ value, onChange, mode, maxLength, groupThousands });
  return (
    <PrimitiveInput
      ref={ref}
      {...rest}
      {...localized}
      className={cn(localized.className, className)}
    />
  );
});
