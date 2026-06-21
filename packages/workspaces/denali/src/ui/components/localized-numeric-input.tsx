"use client";

import { forwardRef, type ComponentProps } from "react";

import { Input as PrimitiveInput } from "../adapters/platform-primitives";

import {
  useLocalizedNumericInput,
  type UseLocalizedNumericInputOptions,
} from "../hooks/use-localized-numeric-input";
import { cn } from "../utils/cn";

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
