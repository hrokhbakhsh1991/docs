import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import type { PlatformCssVariable, SemanticCssVariable } from "@app-tour/design-tokens";

import { cn } from "../utils/cn";
import styles from "./Button.module.css";

/** Keep in sync with `buttonVariants` in `../tokens/component-token-maps.ts`. */
export const buttonVariants = ["primary", "secondary", "ghost"] as const;
export type ButtonVariant = (typeof buttonVariants)[number];

/** Semantic tokens used by button variants (see buttonVariantColorTokens). */
export type ButtonSemanticColor = Extract<
  SemanticCssVariable,
  "--color-surface" | "--color-border" | "--color-focus-ring"
>;

/** Theme tokens used by button variants (see buttonVariantColorTokens). */
export type ButtonThemeColor = Extract<PlatformCssVariable, "--color-primary" | "--color-primary-fg">;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Maps to variant classes; colors use {@link buttonVariantColorTokens} in `../tokens`. */
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      className={cn(styles.button, variantClass[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
});
