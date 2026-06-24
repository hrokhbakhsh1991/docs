"use client";

import type { WizardSubmitErrorPresentation } from "@/wizard/resolve-wizard-submit-error-message";

export function WizardSubmitErrorAlert(props: {
  readonly presentation: WizardSubmitErrorPresentation | null;
  readonly testId?: string;
  readonly className?: string;
}) {
  if (props.presentation == null) {
    return null;
  }

  const { summary, details } = props.presentation;
  const hasDetails = details != null && details.length > 0;

  return (
    <div
      role="alert"
      data-tour-create-error
      data-testid={props.testId}
      className={props.className}
    >
      <p className="wizard-submit-error__summary">{summary}</p>
      {hasDetails ? (
        <ul className="wizard-submit-error__list">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
