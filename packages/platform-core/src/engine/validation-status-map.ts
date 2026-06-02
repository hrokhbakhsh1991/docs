import type { ValidationResult, ValidationViolation } from "../types/validation-result";

const OK_RESULT: ValidationResult = { ok: true, violations: [] };

type MutableViolation = {
  code: string;
  fieldId?: string;
  message: string;
};

/**
 * In-place violation recorder — reuses slots; dedupes by fieldId on hot path.
 */
export class ValidationStatusMap {
  private readonly buffer: MutableViolation[] = [];
  private readonly fieldIndex = new Map<string, number>();
  private size = 0;

  reset(): void {
    this.size = 0;
    this.fieldIndex.clear();
  }

  record(code: string, fieldId: string | undefined, message: string): void {
    if (fieldId != null) {
      if (this.fieldIndex.has(fieldId)) {
        return;
      }
      this.fieldIndex.set(fieldId, this.size);
    }

    const slot = this.buffer[this.size];
    if (slot != null) {
      slot.code = code;
      slot.fieldId = fieldId;
      slot.message = message;
    } else {
      this.buffer[this.size] = { code, fieldId, message };
    }
    this.size += 1;
  }

  finalize(): ValidationResult {
    if (this.size === 0) {
      return OK_RESULT;
    }
    return {
      ok: false,
      violations: this.buffer.slice(0, this.size) as readonly ValidationViolation[],
    };
  }
}
