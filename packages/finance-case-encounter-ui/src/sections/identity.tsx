import type { CaseEncounterLabelBundle } from "../labels";
import type { CaseEncounterViewContract } from "../contract";

export type EncounterIdentitySectionProps = {
  readonly encounter: CaseEncounterViewContract;
  readonly labels: CaseEncounterLabelBundle;
  readonly counterpartyLabel?: string;
};

/** Identity — opaque ids + subject kind only. */
export function EncounterIdentitySection({
  encounter,
  labels,
  counterpartyLabel,
}: EncounterIdentitySectionProps) {
  return (
    <section
      data-testid="case-encounter-identity"
      data-channel="identity"
      aria-labelledby="case-encounter-identity-heading"
    >
      <h2 id="case-encounter-identity-heading">{labels.sections.identity}</h2>
      <dl>
        <div>
          <dt>{labels.fields.caseKey}</dt>
          <dd data-testid="case-encounter-case-key">{encounter.caseKey}</dd>
        </div>
        <div>
          <dt>{labels.fields.subjectKind}</dt>
          <dd data-testid="case-encounter-subject-kind">
            {labels.subjectKind[encounter.subjectKind]}
          </dd>
        </div>
        <div>
          <dt>{labels.fields.subjectId}</dt>
          <dd data-testid="case-encounter-subject-id">{encounter.subjectId}</dd>
        </div>
        {counterpartyLabel !== undefined ? (
          <div>
            <dt>{labels.fields.counterparty}</dt>
            <dd data-testid="case-encounter-counterparty">{counterpartyLabel}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
