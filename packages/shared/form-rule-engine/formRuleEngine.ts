import { readFormPath, snapshotFormValues } from "./formPath";
import type { LookupRegistry } from "./lookupRegistry";
import type {
  EvaluatedFieldRule,
  LookupFieldState,
  LookupStateListener,
  RuleConfig,
  RulePredicate,
} from "./types";

export type FormRuleEngineOptions<TForm extends Record<string, unknown>> = {
  rules: readonly RuleConfig<TForm>[];
  registry: LookupRegistry;
  getFormValues: () => TForm;
  readPath?: (form: TForm, path: string) => unknown;
};

function resolveRuleFlag<TForm extends Record<string, unknown>>(
  value: boolean | RulePredicate<TForm> | undefined,
  form: TForm,
  readPath: (path: string) => unknown,
  defaultValue: boolean,
): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  return value({ form, readPath });
}

const IDLE_LOOKUP_STATE: LookupFieldState = {
  status: "idle",
  items: [],
  requestId: 0,
  dependencySnapshot: "{}",
  searchText: "",
};

/**
 * UI-agnostic form rule engine: visibility / required evaluation, lookup registry integration,
 * and dependency-driven autocomplete refetch.
 */
export class FormRuleEngine<TForm extends Record<string, unknown> = Record<string, unknown>> {
  private readonly rules: readonly RuleConfig<TForm>[];
  private readonly rulesByPath = new Map<string, RuleConfig<TForm>>();
  private readonly registry: LookupRegistry;
  private readonly getFormValues: () => TForm;
  private readonly readPath: (form: TForm, path: string) => unknown;

  /** dependency path → lookup field paths that must refetch when it changes */
  private readonly dependencyIndex = new Map<string, Set<string>>();
  private readonly lookupStates = new Map<string, LookupFieldState>();
  private readonly lookupListeners = new Map<string, Set<LookupStateListener>>();
  private readonly lastSearchText = new Map<string, string>();
  private readonly lastDependencySnapshots = new Map<string, string>();
  /** Latest in-flight / completed request id per lookup field (stale-response guard). */
  private readonly inflightRequestId = new Map<string, number>();
  private requestCounter = 0;

  constructor(options: FormRuleEngineOptions<TForm>) {
    this.rules = options.rules;
    this.registry = options.registry;
    this.getFormValues = options.getFormValues;
    this.readPath =
      options.readPath ?? ((form, path) => readFormPath(form, path));

    for (const rule of this.rules) {
      if (this.rulesByPath.has(rule.path)) {
        throw new Error(
          `FormRuleEngine: duplicate rule path "${rule.path}"`,
        );
      }
      this.rulesByPath.set(rule.path, rule);

      if (rule.lookupProvider != null && rule.dependencies != null) {
        for (const dep of rule.dependencies) {
          const bucket = this.dependencyIndex.get(dep) ?? new Set<string>();
          bucket.add(rule.path);
          this.dependencyIndex.set(dep, bucket);
        }
      }

      if (rule.lookupProvider != null) {
        this.lookupStates.set(rule.path, { ...IDLE_LOOKUP_STATE });
        this.lastDependencySnapshots.set(
          rule.path,
          this.buildDependencySnapshot(rule.path),
        );
      }
    }
  }

  getRule(path: string): RuleConfig<TForm> | undefined {
    return this.rulesByPath.get(path);
  }

  evaluateField(path: string): EvaluatedFieldRule {
    const rule = this.rulesByPath.get(path);
    const form = this.getFormValues();
    const read = (p: string) => this.readPath(form, p);

    if (rule == null) {
      return {
        path,
        visible: true,
        required: false,
        dependencies: [],
      };
    }

    return {
      path,
      visible: resolveRuleFlag(rule.visible, form, read, true),
      required: resolveRuleFlag(rule.required, form, read, false),
      lookupProvider: rule.lookupProvider,
      dependencies: rule.dependencies ?? [],
    };
  }

  evaluateAll(): EvaluatedFieldRule[] {
    return this.rules.map((rule) => this.evaluateField(rule.path));
  }

  getLookupState<TItem = unknown>(fieldPath: string): LookupFieldState<TItem> | undefined {
    return this.lookupStates.get(fieldPath) as LookupFieldState<TItem> | undefined;
  }

  subscribeLookup<TItem = unknown>(
    fieldPath: string,
    listener: LookupStateListener<TItem>,
  ): () => void {
    const bucket = this.lookupListeners.get(fieldPath) ?? new Set();
    bucket.add(listener as LookupStateListener);
    this.lookupListeners.set(fieldPath, bucket);

    const current = this.lookupStates.get(fieldPath);
    if (current != null) {
      listener(current as LookupFieldState<TItem>);
    }

    return () => {
      const set = this.lookupListeners.get(fieldPath);
      if (set == null) return;
      set.delete(listener as LookupStateListener);
      if (set.size === 0) {
        this.lookupListeners.delete(fieldPath);
      }
    };
  }

  /**
   * Notify the engine that a form path changed. Refetches lookups when:
   * - the changed path is a lookup field (optional new `searchText`), or
   * - the changed path appears in another field's `dependencies`.
   */
  async handleFieldChange(
    changedPath: string,
    options?: { searchText?: string },
  ): Promise<string[]> {
    const refetched: string[] = [];
    const pending: Array<Promise<unknown>> = [];

    const ownRule = this.rulesByPath.get(changedPath);
    if (ownRule?.lookupProvider != null) {
      const text =
        options?.searchText ?? this.lastSearchText.get(changedPath) ?? "";
      this.lastSearchText.set(changedPath, text);
      pending.push(this.refetchLookup(changedPath, text));
      refetched.push(changedPath);
    }

    const dependents = this.dependencyIndex.get(changedPath);
    if (dependents != null) {
      for (const fieldPath of dependents) {
        const scheduled = this.scheduleRefetchIfDependenciesChanged(fieldPath);
        if (scheduled != null) {
          pending.push(scheduled);
          refetched.push(fieldPath);
        }
      }
    }

    await Promise.all(pending);
    return refetched;
  }

  /** Field paths with lookups that list `dependencyPath` in `dependencies`. */
  getLookupFieldsAffectedByDependency(dependencyPath: string): readonly string[] {
    const set = this.dependencyIndex.get(dependencyPath);
    return set == null ? [] : [...set];
  }

  async refetchLookup<TItem = unknown>(
    fieldPath: string,
    searchText: string,
  ): Promise<LookupFieldState<TItem>> {
    const rule = this.rulesByPath.get(fieldPath);
    if (rule?.lookupProvider == null) {
      throw new Error(
        `FormRuleEngine.refetchLookup: field "${fieldPath}" has no lookupProvider`,
      );
    }
    if (!this.registry.has(rule.lookupProvider)) {
      throw new Error(
        `FormRuleEngine.refetchLookup: unknown lookupProvider "${rule.lookupProvider}"`,
      );
    }

    const requestId = ++this.requestCounter;
    this.inflightRequestId.set(fieldPath, requestId);
    const form = this.getFormValues();
    const dependencyValues = this.collectDependencyValues(rule);
    const dependencySnapshot = snapshotFormValues(form, rule.dependencies ?? []);

    this.lastSearchText.set(fieldPath, searchText);
    this.lastDependencySnapshots.set(fieldPath, dependencySnapshot);

    this.publishLookupState(fieldPath, {
      status: "loading",
      items: this.lookupStates.get(fieldPath)?.items ?? [],
      requestId,
      dependencySnapshot,
      searchText,
    });

    try {
      const result = await this.registry.search<TItem, TForm>(rule.lookupProvider, {
        providerId: rule.lookupProvider,
        fieldPath,
        searchText,
        form,
        dependencyValues,
      });

      if (this.inflightRequestId.get(fieldPath) !== requestId) {
        return this.lookupStates.get(fieldPath) as LookupFieldState<TItem>;
      }

      const next: LookupFieldState<TItem> = {
        status: "success",
        items: result.items,
        requestId,
        dependencySnapshot,
        searchText,
      };
      this.publishLookupState(fieldPath, next);
      return next;
    } catch (error) {
      if (this.inflightRequestId.get(fieldPath) !== requestId) {
        return this.lookupStates.get(fieldPath) as LookupFieldState<TItem>;
      }
      const message =
        error instanceof Error ? error.message : "Lookup failed";
      const next: LookupFieldState<TItem> = {
        status: "error",
        items: [],
        error: message,
        requestId,
        dependencySnapshot,
        searchText,
      };
      this.publishLookupState(fieldPath, next);
      return next;
    }
  }

  private scheduleRefetchIfDependenciesChanged(
    fieldPath: string,
  ): Promise<LookupFieldState> | null {
    const rule = this.rulesByPath.get(fieldPath);
    if (rule?.lookupProvider == null) return null;

    const nextSnapshot = this.buildDependencySnapshot(fieldPath);
    const prevSnapshot = this.lastDependencySnapshots.get(fieldPath);
    if (prevSnapshot === nextSnapshot) {
      return null;
    }

    const searchText = this.lastSearchText.get(fieldPath) ?? "";
    return this.refetchLookup(fieldPath, searchText);
  }

  private buildDependencySnapshot(fieldPath: string): string {
    const rule = this.rulesByPath.get(fieldPath);
    if (rule?.dependencies == null || rule.dependencies.length === 0) {
      return "{}";
    }
    return snapshotFormValues(this.getFormValues(), rule.dependencies);
  }

  private collectDependencyValues(
    rule: RuleConfig<TForm>,
  ): Record<string, unknown> {
    const form = this.getFormValues();
    const out: Record<string, unknown> = {};
    for (const path of rule.dependencies ?? []) {
      out[path] = this.readPath(form, path);
    }
    return out;
  }

  private publishLookupState(fieldPath: string, state: LookupFieldState): void {
    this.lookupStates.set(fieldPath, state);
    const listeners = this.lookupListeners.get(fieldPath);
    if (listeners == null) return;
    for (const listener of listeners) {
      listener(state);
    }
  }
}
