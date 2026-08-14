/** Minimal validation metadata for declarative intake fields (extensible). */
export type FieldRules = {
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
};

export type IntakeFieldType = "text" | "date" | "email" | "number" | "boolean";

/**
 * Digit-string controls for intake:
 * - `numeric-text` / `localized-digits` — both render as `type="text"` + `inputMode="numeric"`
 *   (never HTML `type="number"`; preserves leading zeros e.g. Iranian mobile).
 * True quantities use `IntakeFieldType` `"number"`.
 */
export type IntakeFieldWidget = "numeric-text" | "localized-digits";

export type IntakeField = {
  readonly id: string;
  readonly type: IntakeFieldType;
  readonly required: boolean;
  /** next-intl message key under catalogRegistration namespace */
  readonly labelKey: string;
  readonly rules?: FieldRules;
  readonly widget?: IntakeFieldWidget;
};

export type IntakeSchemaFeatures = {
  readonly registrantTargetTabs: boolean;
  readonly transportIntake: boolean;
  readonly notesAtIntake: boolean;
  readonly idempotencyKey: boolean;
  /**
   * Portal catalog POST must send member Bearer — no anonymous guest write.
   * Workspaces with member-only intake set true; guest-write surfaces omit or set false.
   */
  readonly requiresMemberSession?: boolean;
  /**
   * Enables `GET …/registrations/for-tour/:tourId` member self-gate
   * (path derived from intake `registrationApiPath`).
   */
  readonly selfRegistrationGate?: boolean;
  /**
   * Enables member `PATCH …/registrations/:id` pending intake amend (transport allowlist).
   */
  readonly memberPendingIntakeAmend?: boolean;
  /** Extra `data-*` attributes on `[data-public-registration-success]` for workspace E2E smokes. */
  readonly successDataAttributes?: Readonly<Record<string, boolean>>;
};

export type IntakeSchema = {
  readonly fields: readonly IntakeField[];
  readonly features: IntakeSchemaFeatures;
};

export type IntakeSchemaTourRequirements = {
  readonly nationalIdRequired?: boolean;
  readonly fatherNameRequired?: boolean;
  readonly birthDateRequired?: boolean;
};

export type IntakeSchemaContext = {
  readonly registrantTarget: "self" | "other";
  readonly session: {
    readonly fullName?: string;
    readonly nationalId?: string;
    readonly fatherName?: string;
    readonly birthDate?: string;
    readonly email?: string;
  };
  /** Catalog egress flags — workspace gates participant fields before session hide. */
  readonly tourRequirements?: IntakeSchemaTourRequirements;
};

export type IntakeSchemaValidationIssue = {
  readonly fieldId: string;
  readonly code: "required" | "pattern";
};

/**
 * Future workspace plugin surface for declarative catalog intake.
 * Plugins may implement this instead of relying on SDK capability maps.
 */
export type WorkspaceCatalogIntakeSchemaProvider = {
  intakeSchema(): IntakeSchema;
};
