import type { CaseEncounterLabelBundle } from "../labels";
import type { CaseEncounterViewContract } from "../contract";

export type EncounterOwnershipSectionProps = {
  readonly encounter: CaseEncounterViewContract;
  readonly labels: CaseEncounterLabelBundle;
};

/** Ownership — display interpreter owner/lane/posture only. */
export function EncounterOwnershipSection({
  encounter,
  labels,
}: EncounterOwnershipSectionProps) {
  const { explainability } = encounter;
  return (
    <section
      data-testid="case-encounter-ownership"
      data-channel="verdict"
      aria-labelledby="case-encounter-ownership-heading"
    >
      <h2 id="case-encounter-ownership-heading">{labels.sections.ownership}</h2>
      <dl>
        <div>
          <dt>{labels.fields.owner}</dt>
          <dd data-testid="case-encounter-owner">
            {labels.owner[explainability.owner]}
          </dd>
        </div>
        <div>
          <dt>{labels.fields.ownerSummary}</dt>
          <dd data-testid="case-encounter-owner-summary">{explainability.ownerSummary}</dd>
        </div>
        <div>
          <dt>{labels.fields.lane}</dt>
          <dd data-testid="case-encounter-lane">{labels.lane[explainability.lane]}</dd>
        </div>
        <div>
          <dt>{labels.fields.posture}</dt>
          <dd data-testid="case-encounter-posture">
            {labels.posture[explainability.primaryPosture]}
          </dd>
        </div>
        <div>
          <dt>{labels.fields.decisionReady}</dt>
          <dd data-testid="case-encounter-decision-ready">
            {explainability.decisionReady ? "yes" : "no"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
