/**
 * Workspace-agnostic structural guards for wizard registry ↔ focus-map alignment.
 */

export interface WizardRegistryField<StepId extends string = string> {
  canonicalPath: string;
  rhfPath: string;
  stepId: StepId;
}

export interface WizardTestIdPrefixes {
  validationFieldLink: string;
  publishReadinessFieldLink: string;
  summaryError: string;
  publishReadinessWarning: string;
}

export interface WizardPublishReadinessIssue {
  code: string;
  message: string;
  path?: string;
}

export interface WizardPublishReadinessIssueView {
  formPath?: string;
  stepId?: string;
}

export interface WizardPublishReadinessTestConfig<
  Code extends string = string,
  Issue extends WizardPublishReadinessIssue = WizardPublishReadinessIssue,
  Form = unknown,
> {
  blockingCodes: readonly Code[];
  pathFixtures: Readonly<Record<Code, readonly Issue[]>>;
  hasResolvablePath: (issue: Issue) => boolean;
  getIssues: (form: Form) => readonly Issue[];
  /** Named codes for guard tests (avoids string literals in specs). */
  codes: Readonly<Record<string, Code>>;
  buildIssueViews?: (
    issues: readonly Issue[],
    form: Form,
    t: (key: string) => string,
  ) => readonly WizardPublishReadinessIssueView[];
}

export interface WizardTestConfig<
  StepId extends string = string,
  Form = unknown,
> {
  /** Workspace wizard rail identifier (e.g. denali). */
  railId?: string;
  /** Ordered wizard step ids. */
  steps?: readonly StepId[];
  /** Registry rows (workspace field definitions). */
  fieldRegistry: readonly WizardRegistryField<StepId>[];
  /** RHF paths that have focus selectors (workspace focus map keys). */
  getFocusMapKeys: () => ReadonlySet<string>;
  /** stepIds excluded from focus-map requirement (e.g. display-only review). */
  nonFocusableStepIds?: readonly StepId[];
  /** data-testid prefixes used on review / validation UI. */
  testIds?: WizardTestIdPrefixes;
  /** RHF paths referenced by structural guard scenarios. */
  paths?: Readonly<Record<string, string>>;
  /** Publish-readiness gate metadata for path-coverage guards. */
  publishReadiness?: WizardPublishReadinessTestConfig<
    string,
    WizardPublishReadinessIssue,
    Form
  >;
  /** Default tour kind for active-publish guard scenarios. */
  defaultActiveTourKind?: string;
  /** Form fixture that triggers publish-readiness issues (e.g. empty gathering points). */
  buildActivePublishGuardForm?: () => Form;
  /** Maps an issue form path to the wizard step that owns the field. */
  stepIdForFormPath?: (formPath: string) => StepId | undefined;
}

/** Builds a validation or publish-readiness issue link data-testid. */
export function wizardIssueLinkTestId(prefix: string, formPath: string): string {
  return `${prefix}-${formPath.replace(/\./g, "-")}`;
}

/**
 * Every registry field assigned to a focusable step must have a focus-map entry for its RHF path.
 */
export function verifyRegistryFocusCoverage<StepId extends string>(
  config: WizardTestConfig<StepId>,
): void {
  const focusKeys = config.getFocusMapKeys();
  const nonFocusable = new Set(config.nonFocusableStepIds ?? []);
  const seenRhf = new Set<string>();
  const missing: string[] = [];

  for (const def of config.fieldRegistry) {
    if (nonFocusable.has(def.stepId)) continue;
    if (seenRhf.has(def.rhfPath)) continue;
    seenRhf.add(def.rhfPath);

    if (!focusKeys.has(def.rhfPath)) {
      missing.push(`${def.canonicalPath} (rhf: ${def.rhfPath}, step: ${def.stepId})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Add focus selectors for:\n${missing.join("\n")}`);
  }
}

/**
 * Every focus-map key must correspond to a registered RHF path.
 */
export function verifyFocusMapOrphans<StepId extends string>(
  config: WizardTestConfig<StepId>,
): void {
  const registryRhf = new Set(config.fieldRegistry.map((def) => def.rhfPath));
  const orphanFocusKeys = [...config.getFocusMapKeys()].filter((key) => !registryRhf.has(key));

  if (orphanFocusKeys.length > 0) {
    throw new Error(
      `Focus map keys without registry RHF path:\n${orphanFocusKeys.join("\n")}`,
    );
  }
}

function requirePublishReadiness<StepId extends string, Form>(
  config: WizardTestConfig<StepId, Form>,
): WizardPublishReadinessTestConfig<string, WizardPublishReadinessIssue, Form> {
  const publishReadiness = config.publishReadiness;
  if (publishReadiness == null) {
    throw new Error("WizardTestConfig.publishReadiness is required for this guard");
  }
  return publishReadiness;
}

/** Every blocking publish-readiness code has fixtures with resolvable form paths. */
export function verifyPublishReadinessPathFixtures<StepId extends string, Form>(
  config: WizardTestConfig<StepId, Form>,
): void {
  const publishReadiness = requirePublishReadiness(config);

  for (const code of publishReadiness.blockingCodes) {
    const fixtures = publishReadiness.pathFixtures[code];
    if (fixtures == null || fixtures.length === 0) {
      throw new Error(`${code} must have at least one fixture`);
    }
    for (const issue of fixtures) {
      if (!publishReadiness.hasResolvablePath(issue)) {
        throw new Error(
          `${code} fixture must resolve a form path: ${JSON.stringify(issue)}`,
        );
      }
    }
  }
}

/** Payload-unbuildable (or first fixture per codes.payloadUnbuildable) resolves without an explicit path. */
export function verifyPublishReadinessPayloadUnbuildableResolves<
  StepId extends string,
  Form,
>(config: WizardTestConfig<StepId, Form>): void {
  const publishReadiness = requirePublishReadiness(config);
  const code =
    publishReadiness.codes.payloadUnbuildable ??
    publishReadiness.blockingCodes.find((c) => c.includes("UNBUILDABLE"));
  if (code == null) {
    throw new Error("publishReadiness.codes.payloadUnbuildable is required");
  }
  const fixture = publishReadiness.pathFixtures[code]?.[0];
  if (fixture == null || !publishReadiness.hasResolvablePath(fixture)) {
    throw new Error(`${code} first fixture must resolve a form path`);
  }
}

/** Active-publish guard form produces issues that all resolve to form paths. */
export function verifyPublishReadinessActiveIssuesResolve<StepId extends string, Form>(
  config: WizardTestConfig<StepId, Form>,
): void {
  const publishReadiness = requirePublishReadiness(config);
  if (config.buildActivePublishGuardForm == null) {
    throw new Error("WizardTestConfig.buildActivePublishGuardForm is required");
  }

  const form = config.buildActivePublishGuardForm();
  const issues = publishReadiness.getIssues(form);
  if (issues.length === 0) {
    throw new Error("expected publish-readiness issues for active guard form");
  }

  for (const issue of issues) {
    if (!publishReadiness.hasResolvablePath(issue)) {
      throw new Error(
        `publish issue must not be anonymous: ${issue.code} ${issue.message}`,
      );
    }
  }
}

/** Geo (or configured) readiness issues carry paths and map to wizard steps in review views. */
export function verifyPublishReadinessGeoMapsToSteps<StepId extends string, Form>(
  config: WizardTestConfig<StepId, Form>,
  t: (key: string) => string,
): void {
  const publishReadiness = requirePublishReadiness(config);
  if (config.buildActivePublishGuardForm == null) {
    throw new Error("WizardTestConfig.buildActivePublishGuardForm is required");
  }
  if (publishReadiness.buildIssueViews == null) {
    throw new Error("publishReadiness.buildIssueViews is required");
  }

  const geoCode =
    publishReadiness.codes.requiresGeolocationZones ??
    publishReadiness.blockingCodes.find((c) => c.includes("GEOLOCATION"));
  if (geoCode == null) {
    throw new Error("publishReadiness.codes.requiresGeolocationZones is required");
  }

  const form = config.buildActivePublishGuardForm();
  const geoIssues = publishReadiness.getIssues(form).filter((issue) => issue.code === geoCode);
  if (geoIssues.length === 0) {
    throw new Error("expected geo publish-readiness issues");
  }

  for (const issue of geoIssues) {
    if (issue.path == null || issue.path.length === 0) {
      throw new Error(`geo issue must carry path: ${issue.message}`);
    }
    const [view] = publishReadiness.buildIssueViews([issue], form, t);
    if (view?.formPath !== issue.path) {
      throw new Error(`expected view formPath ${issue.path}, got ${view?.formPath}`);
    }
    const expectedStepId = config.stepIdForFormPath?.(issue.path);
    if (expectedStepId != null && view?.stepId !== expectedStepId) {
      throw new Error(`expected step ${expectedStepId}, got ${view?.stepId}`);
    }
  }
}
