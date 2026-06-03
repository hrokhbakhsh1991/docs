import type { ValidationResult, ValidationViolation } from "../types/validation-result";

const OK_RESULT: ValidationResult = { ok: true, violations: [] };

type MutableViolation = {
  code: string;
  fieldId?: string;
  message: string;
};

export type ViolationCollector = {
  reset(): void;
  record(code: string, fieldId: string | undefined, message: string): void;
  finalize(): ValidationResult;
};

/** In-place violation recorder — reuses slots; dedupes by fieldId on hot path. */
export function createViolationCollector(): ViolationCollector {
  const buffer: MutableViolation[] = [];
  const fieldIndex = new Map<string, number>();
  let size = 0;

  return {
    reset() {
      size = 0;
      fieldIndex.clear();
    },

    record(code: string, fieldId: string | undefined, message: string) {
      if (fieldId != null) {
        if (fieldIndex.has(fieldId)) {
          return;
        }
        fieldIndex.set(fieldId, size);
      }

      const slot = buffer[size];
      if (slot != null) {
        slot.code = code;
        slot.fieldId = fieldId;
        slot.message = message;
      } else {
        buffer[size] = { code, fieldId, message };
      }
      size += 1;
    },

    finalize(): ValidationResult {
      if (size === 0) {
        return OK_RESULT;
      }
      return {
        ok: false,
        violations: buffer.slice(0, size) as readonly ValidationViolation[],
      };
    },
  };
}
