import type { CaseEncounterLabelBundle } from "../labels";
import type { CaseEncounterViewContract } from "../contract";

export type EncounterCompletenessSectionProps = {
  readonly encounter: CaseEncounterViewContract;
  readonly labels: CaseEncounterLabelBundle;
};

/** Completeness — display class + flags from EncounterView only. */
export function EncounterCompletenessSection({
  encounter,
  labels,
}: EncounterCompletenessSectionProps) {
  const { completeness } = encounter;
  return (
    <section
      data-testid="case-encounter-completeness"
      data-channel="verdict"
      aria-labelledby="case-encounter-completeness-heading"
    >
      <h2 id="case-encounter-completeness-heading">{labels.sections.completeness}</h2>
      <dl>
        <div>
          <dt>{labels.fields.completenessClass}</dt>
          <dd data-testid="case-encounter-completeness-class">
            {labels.completeness[completeness.completenessClass]}
          </dd>
        </div>
        <div>
          <dt>Act ready</dt>
          <dd data-testid="case-encounter-act-ready">{completeness.actReady ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt>Wait complete</dt>
          <dd data-testid="case-encounter-wait-complete">
            {completeness.waitComplete ? "yes" : "no"}
          </dd>
        </div>
        <div>
          <dt>Inspect forced</dt>
          <dd data-testid="case-encounter-inspect-forced">
            {completeness.inspectForced ? "yes" : "no"}
          </dd>
        </div>
        <div>
          <dt>Escalate forced</dt>
          <dd data-testid="case-encounter-escalate-forced">
            {completeness.escalateForced ? "yes" : "no"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
