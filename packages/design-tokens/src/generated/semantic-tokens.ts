/** @generated — do not edit; run pnpm build in @app-tour/design-tokens */

export const semanticTokenVars = {
  colorBorder: "--color-border",
  colorFocusRing: "--color-focus-ring",
  colorSurface: "--color-surface",
  colorSurfaceMuted: "--color-surface-muted",
} as const;

export type SemanticTokenKey = keyof typeof semanticTokenVars;
export type SemanticCssVariable = (typeof semanticTokenVars)[SemanticTokenKey];

export function semanticVar(key: SemanticTokenKey): `var(${SemanticCssVariable})` {
  return `var(${semanticTokenVars[key]})`;
}
