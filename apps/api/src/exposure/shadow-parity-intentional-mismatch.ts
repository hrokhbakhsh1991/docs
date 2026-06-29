/**
 * Diagnostics-only registry for intentional forward-shadow parity deltas.
 *
 * Runtime field selection no longer has an accepted cutover scope. This registry exists only so
 * operators can suppress already-triaged shadow parity mismatches by exact coordinate + field id.
 */
export const FIELD_EXPOSURE_INTENTIONAL_SHADOW_PARITY_MISMATCHES: readonly {
  readonly workspaceType: string;
  readonly eventType: string;
  readonly surface: string;
  readonly fieldId: string;
  readonly reason: string;
}[] = [];

export function createShadowParityIntentionalMismatchAdjuster(
  intentionalMismatches: readonly {
    readonly workspaceType: string;
    readonly eventType: string;
    readonly surface: string;
    readonly fieldId: string;
    readonly reason: string;
  }[],
) {
  return function adjustShadowParityForIntentionalMismatches(input: {
    readonly workspaceType: string;
    readonly eventType: string;
    readonly surface: string;
    readonly report: {
      readonly matches: boolean;
      readonly mismatchCount: number;
      readonly fieldReports: readonly {
        readonly fieldId: string;
        readonly mismatch: string | null;
      }[];
    };
  }): {
    readonly matches: boolean;
    readonly mismatchCount: number;
    readonly fieldReports: typeof input.report.fieldReports;
  } {
    const fieldReports = input.report.fieldReports.map((report) => {
      const isIntentional = intentionalMismatches.some(
        (entry) =>
          entry.workspaceType === input.workspaceType &&
          entry.eventType === input.eventType &&
          entry.surface === input.surface &&
          entry.fieldId === report.fieldId,
      );
      if (report.mismatch === null || !isIntentional) {
        return report;
      }

      return {
        ...report,
        mismatch: null,
      };
    });
    const mismatchCount = fieldReports.filter((report) => report.mismatch !== null).length;

    return {
      fieldReports,
      mismatchCount,
      matches: mismatchCount === 0,
    };
  };
}

export function adjustShadowParityForIntentionalMismatches(input: {
  readonly workspaceType: string;
  readonly eventType: string;
  readonly surface: string;
  readonly report: {
    readonly matches: boolean;
    readonly mismatchCount: number;
    readonly fieldReports: readonly {
      readonly fieldId: string;
      readonly mismatch: string | null;
    }[];
  };
}): {
  readonly matches: boolean;
  readonly mismatchCount: number;
  readonly fieldReports: typeof input.report.fieldReports;
} {
  return createShadowParityIntentionalMismatchAdjuster(
    FIELD_EXPOSURE_INTENTIONAL_SHADOW_PARITY_MISMATCHES,
  )(input);
}
