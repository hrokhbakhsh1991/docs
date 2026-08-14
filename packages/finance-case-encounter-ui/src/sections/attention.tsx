import type { CaseEncounterLabelBundle } from "../labels";
import type { CaseEncounterViewContract } from "../contract";

export type EncounterAttentionSectionProps = {
  readonly encounter: CaseEncounterViewContract;
  readonly labels: CaseEncounterLabelBundle;
};

/**
 * Attention — signal channel only.
 * Must never be merged into verdict ownership/reading chrome.
 */
export function EncounterAttentionSection({
  encounter,
  labels,
}: EncounterAttentionSectionProps) {
  const attention = encounter.discoveryAttention;
  return (
    <section
      data-testid="case-encounter-attention"
      data-channel="attention"
      aria-labelledby="case-encounter-attention-heading"
    >
      <h2 id="case-encounter-attention-heading">{labels.sections.attention}</h2>
      {attention === null ? (
        <p data-testid="case-encounter-attention-empty">{labels.fields.noAttention}</p>
      ) : (
        <dl>
          <div>
            <dt>Attention class</dt>
            <dd data-testid="case-encounter-attention-class">
              {labels.attentionClass?.[attention.attentionClass] ?? attention.attentionClass}
            </dd>
          </div>
          {attention.reasonCode !== undefined ? (
            <div>
              <dt>Reason code</dt>
              <dd data-testid="case-encounter-attention-reason">{attention.reasonCode}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}
