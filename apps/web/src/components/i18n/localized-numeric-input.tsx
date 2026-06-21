"use client";

import { Input as PrimitiveInput } from "@app-tour/ui-primitives/input";
import { type ComponentProps } from "react";

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

/** Wizard shell numeric field — ui-primitives input with locale-aware digits. */
export function PrimitiveLocalizedNumericInput({
  value,
  onChange,
  mode,
  maxLength,
  groupThousands,
  className,
  ...rest
}: PrimitiveLocalizedNumericInputProps) {
  const localized = useLocalizedNumericInput({ value, onChange, mode, maxLength, groupThousands });
  return (
    <PrimitiveInput
      {...rest}
      {...localized}
      className={cn(localized.className, className)}
    />
  );
}
