/**
 * Standard entity-state paths for SimpleCondition evaluation.
 * Data contract only — no resolver or provider logic.
 */
export const FIELD_POLICY_ENTITY_PATH = {
  dimensions: (key: string): string => `dimensions.${key}`,
  tour: (key: string): string => `tour.${key}`,
  actor: (key: string): string => `actor.${key}`,
  integrations: (key: string): string => `integrations.${key}`,
} as const;

export type FieldPolicyEntityState = Readonly<{
  dimensions?: Readonly<Record<string, string | number | boolean | null>>;
  tour?: Readonly<{
    status?: string;
    publishedAt?: string | null;
  }>;
  actor?: Readonly<{
    role?: string;
    userId?: string;
  }>;
  integrations?: Readonly<{
    activeProviderIds?: readonly string[];
  }>;
}>;
