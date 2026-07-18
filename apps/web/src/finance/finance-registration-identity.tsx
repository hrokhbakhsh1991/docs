import type { FinanceRegistrationContext } from "@/finance/finance-registration-context";
import { FinanceRegistrationLink } from "@/finance/finance-registration-link";

type FinanceRegistrationIdentityProps = {
  readonly registrationId: string;
  readonly context?: FinanceRegistrationContext | null;
  readonly truncateLink?: boolean;
};

export function FinanceRegistrationIdentity({
  registrationId,
  context = null,
  truncateLink = false,
}: FinanceRegistrationIdentityProps) {
  const id = registrationId.trim();
  if (id.length === 0) {
    return null;
  }
  const linkLabel =
    context !== null ? `${context.memberDisplayName} · ${context.tourTitle}` : null;
  return (
    <div className="space-y-0.5" data-testid="finance-registration-identity">
      {context !== null ? (
        <>
          <p className="text-sm font-medium text-foreground">{context.tourTitle}</p>
          <p className="text-sm text-muted-foreground">{context.memberDisplayName}</p>
        </>
      ) : null}
      <FinanceRegistrationLink
        registrationId={id}
        label={linkLabel}
        truncate={truncateLink}
      />
    </div>
  );
}
