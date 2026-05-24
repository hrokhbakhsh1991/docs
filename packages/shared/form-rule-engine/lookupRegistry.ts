/**
 * Registry of autocomplete / lookup providers (API services, in-memory catalogs, …).
 * UI layers register concrete fetchers; {@link FormRuleEngine} invokes them by id.
 */

export type LookupQuery<TForm extends Record<string, unknown> = Record<string, unknown>> = {
  providerId: string;
  fieldPath: string;
  searchText: string;
  form: TForm;
  /** Values for paths listed in the field rule's `dependencies`. */
  dependencyValues: Record<string, unknown>;
};

export type LookupResult<TItem = unknown> = {
  items: TItem[];
};

export type LookupProvider<TItem = unknown, TForm extends Record<string, unknown> = Record<string, unknown>> = (
  query: LookupQuery<TForm>,
) => Promise<LookupResult<TItem>>;

export class LookupRegistry {
  private readonly providers = new Map<string, LookupProvider>();

  register<TItem, TForm extends Record<string, unknown> = Record<string, unknown>>(
    providerId: string,
    provider: LookupProvider<TItem, TForm>,
  ): this {
    if (providerId.trim() === "") {
      throw new Error("LookupRegistry.register: providerId must be non-empty");
    }
    this.providers.set(providerId, provider as LookupProvider);
    return this;
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  async search<TItem = unknown, TForm extends Record<string, unknown> = Record<string, unknown>>(
    providerId: string,
    query: LookupQuery<TForm>,
  ): Promise<LookupResult<TItem>> {
    const provider = this.providers.get(providerId);
    if (provider == null) {
      throw new Error(`LookupRegistry: unknown provider "${providerId}"`);
    }
    return (await provider(query)) as LookupResult<TItem>;
  }
}

/** Process-wide default registry (optional convenience for apps). */
export const defaultLookupRegistry = new LookupRegistry();
