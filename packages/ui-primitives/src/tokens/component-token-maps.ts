import type {
  PrimitiveBorderToken,
  PrimitiveColorToken,
  PrimitiveFocusToken,
  PrimitiveLayoutToken,
  PrimitiveRadius,
  PrimitiveSpacing,
  PrimitiveTypography,
} from "../utils/design-token-types";

/** Button visual variants — each maps to token keys referenced in Button.module.css. */
export const buttonVariants = ["primary", "secondary", "ghost"] as const;
export type ButtonVariant = (typeof buttonVariants)[number];

export const buttonVariantColorTokens: Record<ButtonVariant, readonly PrimitiveColorToken[]> = {
  primary: ["--color-primary", "--color-primary-fg"],
  secondary: ["--color-surface", "--color-primary", "--color-border"],
  ghost: ["--color-bg-transparent", "--color-primary"],
} satisfies Record<ButtonVariant, readonly PrimitiveColorToken[]>;

/** Every custom property referenced in Button.module.css (keep in sync with CSS). */
export const buttonLayoutTokens = {
  gap: "--space-2",
  paddingBlock: "--space-0",
  paddingInline: "--space-4",
  radius: "--radius-md",
  minHeight: "--layout-min-tap-target",
  borderWidth: "--border-width-default",
  ghostBackground: "--color-bg-transparent",
  borderTransparent: "--color-bg-transparent",
  focusRing: "--color-focus-ring",
  focusOutlineWidth: "--focus-outline-width",
  focusOutlineOffset: "--focus-outline-offset",
  disabledOpacity: "--opacity-disabled",
  fontFamily: "--font-family-base",
  fontSize: "--text-body-size",
  lineHeight: "--text-body-leading",
  fontWeight: "--font-weight-semibold",
  display: "--layout-display-inline-flex",
  alignItems: "--layout-align-items-center",
  justifyContent: "--layout-justify-content-center",
  cursor: "--layout-cursor-pointer",
  cursorDisabled: "--layout-cursor-not-allowed",
  borderStyle: "--layout-border-style-solid",
} as const satisfies Record<
  string,
  | PrimitiveSpacing
  | PrimitiveRadius
  | PrimitiveFocusToken
  | PrimitiveTypography
  | PrimitiveLayoutToken
  | PrimitiveBorderToken
  | PrimitiveColorToken
>;

/** Input control tokens — Input.module.css */
export const inputControlTokens = {
  minHeight: "--layout-min-tap-target",
  borderWidth: "--border-width-default",
  focusOutlineWidth: "--focus-outline-width",
  focusOutlineOffset: "--focus-outline-offset",
  paddingBlock: "--space-3",
  paddingInline: "--space-4",
  radius: "--radius-sm",
  surface: "--color-surface",
  border: "--color-border",
  text: "--color-text-primary",
  focusRing: "--color-focus-ring",
  focusBorder: "--color-primary",
  disabledBg: "--color-bg-disabled",
  disabledText: "--color-text-muted",
  invalidBorder: "--color-danger",
  fontFamily: "--font-family-base",
  fontSize: "--text-body-size",
  lineHeight: "--text-body-leading",
  width: "--layout-width-full",
  borderStyle: "--layout-border-style-solid",
  cursorDisabled: "--layout-cursor-not-allowed",
} as const satisfies Record<
  string,
  PrimitiveColorToken | PrimitiveSpacing | PrimitiveRadius | PrimitiveTypography | PrimitiveFocusToken | PrimitiveBorderToken | PrimitiveLayoutToken
>;

/** FieldShell layout tokens — FieldShell.module.css */
export const fieldShellTokens = {
  gap: "--space-2",
  labelText: "--color-text-primary",
  requiredMark: "--color-danger",
  requiredMarkMargin: "--space-1",
  helpText: "--color-text-secondary",
  errorText: "--color-danger",
  labelFontSize: "--text-small-size",
  labelLineHeight: "--text-small-leading",
  labelFontWeight: "--font-weight-semibold",
  blockMarginNone: "--space-0",
  display: "--layout-display-flex",
  flexDirection: "--layout-flex-direction-column",
} as const satisfies Record<
  string,
  PrimitiveColorToken | PrimitiveSpacing | PrimitiveTypography | PrimitiveLayoutToken
>;

export const alertVariants = ["info", "success", "warning", "error"] as const;
export type AlertVariant = (typeof alertVariants)[number];

export const alertVariantColorTokens: Record<AlertVariant, readonly PrimitiveColorToken[]> = {
  info: ["--color-info-bg", "--color-info", "--color-text-secondary"],
  success: ["--color-success-bg", "--color-success", "--color-text-secondary"],
  warning: ["--color-warning-bg", "--color-warning", "--color-text-secondary"],
  error: ["--color-danger-bg", "--color-danger", "--color-text-secondary"],
} satisfies Record<AlertVariant, readonly PrimitiveColorToken[]>;

/** Every custom property referenced in Alert.module.css */
export const alertTokens = {
  gap: "--space-3",
  padding: "--space-4",
  radius: "--radius-md",
  borderWidth: "--border-width-default",
  border: "--color-border",
  iconSlotSize: "--layout-icon-slot",
  iconMarginTop: "--space-1",
  iconFontSize: "--text-small-size",
  iconFontWeight: "--font-weight-semibold",
  iconLineHeight: "--line-height-tight",
  iconFlexShrink: "--layout-flex-shrink-none",
  contentFlexGrow: "--layout-flex-grow-full",
  contentMinWidth: "--layout-min-width-none",
  textMarginBlockStart: "--space-1",
  textMarginInline: "--space-0",
  titleFontSize: "--text-small-size",
  titleFontWeight: "--font-weight-semibold",
  titleLineHeight: "--text-small-leading",
  textFontSize: "--text-small-size",
  textLineHeight: "--text-small-leading",
  textColor: "--color-text-secondary",
  display: "--layout-display-flex",
  alignItems: "--layout-align-items-flex-start",
  alignItemsCenter: "--layout-align-items-center",
  justifyContent: "--layout-justify-content-center",
  titleDisplay: "--layout-display-block",
  borderStyle: "--layout-border-style-solid",
  titleColor: "--color-text-current",
} as const satisfies Record<
  string,
  PrimitiveColorToken | PrimitiveSpacing | PrimitiveRadius | PrimitiveTypography | PrimitiveLayoutToken | PrimitiveBorderToken
>;

export const badgeVariants = ["neutral", "success", "warning", "danger", "info"] as const;
export type BadgeVariant = (typeof badgeVariants)[number];

export const badgeVariantColorTokens: Record<BadgeVariant, readonly PrimitiveColorToken[]> = {
  neutral: ["--color-surface-muted", "--color-text-primary", "--color-border", "--color-border-strong"],
  success: ["--color-success-bg", "--color-success"],
  warning: ["--color-warning-bg", "--color-warning"],
  danger: ["--color-danger-bg", "--color-danger"],
  info: ["--color-info-bg", "--color-info"],
} satisfies Record<BadgeVariant, readonly PrimitiveColorToken[]>;

/** Every custom property referenced in Badge.module.css */
export const badgeTokens = {
  paddingBlock: "--space-1",
  paddingInline: "--space-3",
  radius: "--radius-sm",
  fontSize: "--text-micro-size",
  fontWeight: "--text-micro-weight",
  lineHeight: "--text-micro-leading",
  letterSpacing: "--text-micro-tracking",
  borderWidth: "--border-width-default",
  border: "--color-border",
  display: "--layout-display-inline-flex",
  alignItems: "--layout-align-items-center",
  whiteSpace: "--layout-white-space-nowrap",
  borderStyle: "--layout-border-style-solid",
  neutralBorder: "--color-border-strong",
} as const satisfies Record<
  string,
  PrimitiveColorToken | PrimitiveSpacing | PrimitiveRadius | PrimitiveTypography | PrimitiveBorderToken | PrimitiveLayoutToken
>;

/** Maps component → layout token record for guard tests. */
export const componentCssTokenMaps = {
  button: buttonLayoutTokens,
  input: inputControlTokens,
  fieldShell: fieldShellTokens,
  alert: alertTokens,
  badge: badgeTokens,
} as const;
