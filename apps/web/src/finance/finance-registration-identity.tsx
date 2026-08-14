import type { FinanceRegistrationContext } from "@/finance/finance-registration-context";
import { FinanceRegistrationLink } from "@/finance/finance-registration-link";

type FinanceRegistrationIdentityProps = {
  readonly registrationId: string;
  readonly context?: FinanceRegistrationContext | null;
  readonly truncateLink?: boolean;
  /** Dense Payments list: member + tour · Open booking (no duplicate member·tour link label). */
  readonly density?: "default" | "compact";
};

export function FinanceRegistrationIdentity({
  registrationId,
  context = null,
  truncateLink = false,
  density = "default",
}: FinanceRegistrationIdentityProps) {
  const id = registrationId.trim();
  if (id.length === 0) {
    return null;
  }
  if (density === "compact") {
    return (
      <div className="min-w-0 space-y-0.5" data-testid="finance-registration-identity">
        {context !== null ? (
          <>
            <p className="truncate text-sm font-medium text-foreground">
              {context.memberDisplayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {context.tourTitle}
              {" · "}
              <FinanceRegistrationLink registrationId={id} truncate={truncateLink} />
            </p>
          </>
        ) : (
          <FinanceRegistrationLink registrationId={id} truncate={truncateLink} />
        )}
      </div>
    );
  }
  const linkLabel =
    context !== null ? `${context.memberDisplayName} · ${context.tourTitle}` : null;
  return (
    <div className="space-y-0.5" data-testid="finance-registration-identity">
      {context !== null ? (
        <>
          <p className="text-sm font-medium text-foreground">{context.memberDisplayName}</p>
          <p className="text-sm text-muted-foreground">{context.tourTitle}</p>
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
