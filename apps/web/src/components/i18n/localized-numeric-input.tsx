"use client";

import { Input as PrimitiveInput } from "@app-tour/ui-primitives/input";
import React, { type ComponentProps } from "react";

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
  className,
  ...rest
}: LocalizedNumericInputBaseProps) {
  const localized = useLocalizedNumericInput({ value, onChange, mode, maxLength });
  return <ShadcnInput {...rest} {...localized} className={cn(localized.className, className)} />;
}

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
