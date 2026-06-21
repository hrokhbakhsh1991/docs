const WORKSPACE_THEME_TOKEN_KEY_PATTERN = /^--ws-[a-z0-9-]+$/;

export type WorkspaceDefinitionThemeTokensInput = {
  readonly tokens?: Readonly<Record<string, string>>;
};

export class WorkspaceThemeTokenValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceThemeTokenValidationError";
  }
}

/** Validates semantic `--ws-*` keys on metadata theme token maps (P3-B N-013). */
export function validateWorkspaceThemeTokenMap(
  tokens: Readonly<Record<string, string>>
): Readonly<Record<string, string>> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (!WORKSPACE_THEME_TOKEN_KEY_PATTERN.test(key)) {
      throw new WorkspaceThemeTokenValidationError(`WORKSPACE_THEME_TOKEN_KEY_INVALID:${key}`);
    }
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new WorkspaceThemeTokenValidationError(`WORKSPACE_THEME_TOKEN_VALUE_INVALID:${key}`);
    }
    resolved[key] = value;
  }
  return Object.freeze(resolved);
}

/** Resolve optional metadata theme tokens for plugin overlay merge. */
export function resolveWorkspaceThemeTokens(
  theme: WorkspaceDefinitionThemeTokensInput | undefined
): Readonly<Record<string, string>> | undefined {
  if (theme?.tokens === undefined) {
    return undefined;
  }
  const validated = validateWorkspaceThemeTokenMap(theme.tokens);
  if (Object.keys(validated).length === 0) {
    return undefined;
  }
  return validated;
}
