export interface ValidationViolation {
  readonly code: string;
  readonly fieldId?: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly violations: readonly ValidationViolation[];
}
