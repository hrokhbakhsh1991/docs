/**
 * Typed subsets of @app-tour/design-tokens for primitives.
 * Styling stays in local *.module.css via var(--*); these types guard props and token maps.
 */
import type {
  PlatformCssVariable,
  SemanticCssVariable,
  SemanticCssVariableName,
  SharedCssVariable,
} from "@app-tour/design-tokens";

export type { PlatformCssVariable, SemanticCssVariable, SemanticCssVariableName, SharedCssVariable };

/** Semantic aliases from semantics.css (surface, border, focus ring, …). */
export type PrimitiveSemanticColor = SemanticCssVariable;

/** Platform / theme color variables used by primitives (not workspace --ws-*). */
export type PrimitivePlatformColor = Extract<
  PlatformCssVariable,
  | "--color-primary"
  | "--color-primary-fg"
  | "--color-text-primary"
  | "--color-text-secondary"
  | "--color-text-muted"
  | "--color-danger"
  | "--color-danger-bg"
  | "--color-bg-disabled"
  | "--color-bg-transparent"
  | "--color-info"
  | "--color-info-bg"
  | "--color-success"
  | "--color-success-bg"
  | "--color-warning"
  | "--color-warning-bg"
  | "--color-border-strong"
>;

export type PrimitiveTextColorToken = Extract<SharedCssVariable, "--color-text-current">;

export type PrimitiveColorToken =
  | PrimitiveSemanticColor
  | PrimitivePlatformColor
  | PrimitiveTextColorToken;

export type PrimitiveSpacing = Extract<
  SharedCssVariable,
  "--space-0" | "--space-1" | "--space-2" | "--space-3" | "--space-4" | "--space-5"
>;

export type PrimitiveRadius = Extract<SharedCssVariable, "--radius-sm" | "--radius-md">;

export type PrimitiveTypography = Extract<
  SharedCssVariable,
  | "--font-family-base"
  | "--text-body-size"
  | "--text-body-leading"
  | "--text-small-size"
  | "--text-small-leading"
  | "--text-micro-size"
  | "--text-micro-leading"
  | "--text-micro-weight"
  | "--text-micro-tracking"
  | "--font-weight-semibold"
  | "--line-height-icon"
  | "--line-height-tight"
>;

export type PrimitiveLayoutToken = Extract<
  SharedCssVariable,
  | "--layout-min-tap-target"
  | "--layout-icon-slot"
  | "--layout-width-full"
  | "--layout-min-width-none"
  | "--layout-flex-grow-full"
  | "--layout-flex-shrink-none"
  | "--layout-display-flex"
  | "--layout-display-inline-flex"
  | "--layout-display-block"
  | "--layout-flex-direction-column"
  | "--layout-align-items-center"
  | "--layout-align-items-flex-start"
  | "--layout-justify-content-center"
  | "--layout-white-space-nowrap"
  | "--layout-cursor-pointer"
  | "--layout-cursor-not-allowed"
  | "--layout-border-style-solid"
>;

export type PrimitiveFocusToken = Extract<PrimitiveSemanticColor, "--color-focus-ring">;

export type PrimitiveBorderToken = Extract<
  SharedCssVariable,
  "--border-width-default" | "--focus-outline-width" | "--focus-outline-offset" | "--opacity-disabled"
>;
