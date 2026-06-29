import type { ExposureIntent, ExposureIntentMode, ExposureFieldDecorations } from "./exposure-intent";

export type ExposureIntentScopeValue =
  | string
  | number
  | boolean
  | null
  | readonly ExposureIntentScopeValue[]
  | { readonly [key: string]: ExposureIntentScopeValue };

export type ExposureIntentScope = Readonly<Record<string, ExposureIntentScopeValue>>;

export type ExposureIntentContextKey = {
  readonly tenantId: string;
  readonly profileId: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly scope?: ExposureIntentScope;
};

export type UpsertExposureIntentInput = ExposureIntentContextKey & {
  readonly workspaceType: string | null;
  readonly entityType: string;
  readonly mode: ExposureIntentMode;
  readonly selectedFieldIds?: readonly string[] | null;
  readonly fieldDecorations?: ExposureFieldDecorations | null;
  readonly templateOverrideId?: string | null;
  readonly updatedByUserId?: string | null;
};

export type ExposureIntentRepository = {
  findForContext(input: ExposureIntentContextKey): Promise<ExposureIntent | null>;
  listForConnectionScope(input: {
    readonly tenantId: string;
    readonly connectionId: string;
  }): Promise<readonly ExposureIntent[]>;
  upsert(input: UpsertExposureIntentInput): Promise<ExposureIntent>;
};

function stableScopeValue(value: ExposureIntentScopeValue): unknown {
  if (Array.isArray(value)) {
    return value.map(stableScopeValue);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableScopeValue(nested)]),
    );
  }
  return value;
}

export function normalizeExposureIntentScope(
  scope: ExposureIntentScope | undefined,
): ExposureIntentScope {
  if (scope == null) {
    return {};
  }
  return stableScopeValue(scope) as ExposureIntentScope;
}

export function exposureIntentScopeHash(scope: ExposureIntentScope | undefined): string {
  return JSON.stringify(normalizeExposureIntentScope(scope));
}
