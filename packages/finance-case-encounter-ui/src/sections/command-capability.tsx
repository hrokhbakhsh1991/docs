/**
 * Read-only command capability metadata (PR14-B / PR17-A).
 * Display only — never renders mutation controls.
 */

import type { CaseCommandCapabilityContract } from "../command-capability";
import type { CaseEncounterLabelBundle } from "../labels";

export type EncounterCommandCapabilitySectionProps = {
  readonly capability: CaseCommandCapabilityContract;
  readonly labels: CaseEncounterLabelBundle;
};

export function EncounterCommandCapabilitySection({
  capability,
  labels,
}: EncounterCommandCapabilitySectionProps) {
  const sectionTitle = labels.sections.commandCapability ?? "Command capability";
  const tokensLabel = labels.fields.availableTokens ?? "Available tokens (display only)";
  const endpointLabel = labels.fields.capabilityEndpoint ?? "Bridge endpoint (metadata)";
  const noneLabel = labels.fields.noAvailableTokens ?? "None available for this reading";

  return (
    <section
      data-testid="case-encounter-command-capability"
      data-channel="hint"
      aria-labelledby="case-encounter-command-capability-heading"
    >
      <h2 id="case-encounter-command-capability-heading">{sectionTitle}</h2>
      <p data-testid="case-encounter-supported-commands">
        {labels.fields.supportedCommands ?? "Supported commands"}:{" "}
        {capability.supportedCommands.join(", ")}
      </p>
      <div>
        <h3>{tokensLabel}</h3>
        {capability.reviewReceipt.availableTokens.length === 0 ? (
          <p data-testid="case-encounter-capability-tokens-empty">{noneLabel}</p>
        ) : (
          <ul data-testid="case-encounter-capability-tokens">
            {capability.reviewReceipt.availableTokens.map((token) => (
              <li key={token}>
                <span data-vocabulary="capability">{token}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p data-testid="case-encounter-capability-endpoint">
        {endpointLabel}: <code>{capability.reviewReceipt.endpoint}</code>
      </p>
      <p data-testid="case-encounter-capability-no-actions">
        {labels.fields.capabilityReadOnlyNote ??
          "Read-only metadata — no approve/reject controls on this surface."}
      </p>
    </section>
  );
}
