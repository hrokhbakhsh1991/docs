"use client";

export const DENALI_OPTIONAL_EMPTY_TEST_ID = "denali-optional-empty";

type DenaliOptionalEmptyNoticeProps = {
  readonly children: string;
  readonly testId?: string;
};

/**
 * ED-EMPTY-OPT-01 — optional skip / degraded catalog empty. Status, never alert.
 * Must not be wired to `aria-invalid` or Continue/save blocking.
 */
export function DenaliOptionalEmptyNotice({
  children,
  testId = DENALI_OPTIONAL_EMPTY_TEST_ID,
}: DenaliOptionalEmptyNoticeProps) {
  return (
    <p
      className="denali-wizard-composite__status denali-wizard-composite__optional-empty"
      role="status"
      data-testid={testId}
      data-operator-optional-empty=""
    >
      {children}
    </p>
  );
}
