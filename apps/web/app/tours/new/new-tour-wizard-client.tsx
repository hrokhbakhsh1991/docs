"use client";

import { useState, useTransition } from "react";

import { Button } from "@app-tour/ui-primitives/button";

import { useAppSession } from "@/providers/app-session-context";
import { createTourAction } from "@/tours/create-tour.server";
import { emptyTourWizardDraft, tourWizardDraftToPayload } from "@/tours/tour-wizard-draft";
import { WorkspaceWizardHost } from "@/wizard/workspace-wizard-host";

export function NewTourWizardClient() {
  const session = useAppSession();
  const [draft, setDraft] = useState(emptyTourWizardDraft);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdTourId, setCreatedTourId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = () => {
    setSubmitError(null);
    startTransition(async () => {
      const result = await createTourAction(tourWizardDraftToPayload(draft));
      if (!result.ok) {
        setSubmitError(`${result.status}: ${result.code}`);
        return;
      }
      setCreatedTourId(result.record.id);
    });
  };

  return (
    <div data-new-tour-wizard>
      <WorkspaceWizardHost
        pluginId={session.pluginId}
        tenantId={session.tenantId}
        workspaceId={session.workspaceId}
        authz={session.authz}
        draft={draft}
        onDraftChange={setDraft}
        renderFooter={() => (
          <footer data-wizard-footer>
            <Button type="button" onClick={onSubmit} disabled={pending}>
              {pending ? "Creating tour…" : "Create tour"}
            </Button>
            {submitError ? (
              <p role="alert" data-tour-create-error>
                {submitError}
              </p>
            ) : null}
            {createdTourId ? (
              <p data-tour-created>
                Tour created: <code>{createdTourId}</code>
              </p>
            ) : null}
          </footer>
        )}
      />
    </div>
  );
}
