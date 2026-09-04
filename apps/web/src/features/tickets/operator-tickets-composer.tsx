"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createTicketsIdempotencyKey } from "@/features/tickets/operator-tickets-format";
import type { OperatorTicketDetailView } from "@/features/tickets/operator-tickets-types";
import { OPERATOR_TICKETS_TEST_IDS } from "@/features/tickets/operator-tickets-types";
import { mapOperatorTicketsMutationErrorCode } from "@/features/tickets/classify-operator-tickets-bff-error";

type ComposerMode = "public" | "internal";

type TemplateItem = {
  readonly code: string;
  readonly title: string;
  readonly channel: string;
  readonly locale: string;
};

type Props = {
  readonly detail: OperatorTicketDetailView;
  readonly canMutate: boolean;
  readonly onDetailUpdated: (detail: OperatorTicketDetailView) => void;
  readonly onError: (messageKey: string) => void;
};

export function OperatorTicketsComposer({
  detail,
  canMutate,
  onDetailUpdated,
  onError,
}: Props) {
  const t = useTranslations("tickets");
  const [mode, setMode] = useState<ComposerMode>("public");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [templates, setTemplates] = useState<readonly TemplateItem[]>([]);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState("");
  const idempotencyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canMutate) {
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/ticket-templates?channel=public_reply&locale=en", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const payload = (await res.json()) as { items?: TemplateItem[] };
        if (Array.isArray(payload.items)) {
          setTemplates(payload.items);
        }
      } catch {
        // templates optional
      }
    })();
  }, [canMutate]);

  const applyTemplate = async () => {
    if (selectedTemplateCode.length === 0) {
      return;
    }
    try {
      const res = await fetch(
        `/api/ticket-templates/${encodeURIComponent(selectedTemplateCode)}/preview?channel=public_reply&locale=en`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketSubject: detail.ticket.subject,
            ticketId: detail.ticket.id,
            status: detail.ticket.status,
          }),
        },
      );
      const payload = (await res.json()) as { rendered?: string };
      if (res.ok && typeof payload.rendered === "string") {
        setBody(payload.rendered);
      }
    } catch {
      onError("generic");
    }
  };

  if (!canMutate) {
    return (
      <p className="text-sm text-muted-foreground" data-operator-tickets-composer-readonly>
        {t("readOnlyComposer")}
      </p>
    );
  }

  const submit = async () => {
    if (pending || body.trim().length === 0) {
      return;
    }
    setPending(true);
    const key = idempotencyRef.current ?? createTicketsIdempotencyKey("ticket-msg");
    idempotencyRef.current = key;
    const path =
      mode === "public"
        ? `/api/tickets/${detail.ticket.id}/replies`
        : `/api/tickets/${detail.ticket.id}/internal-notes`;

    try {
      const res = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ body: body.trim() }),
      });
      const payload = (await res.json()) as
        | { readonly ok: true; readonly detail: OperatorTicketDetailView }
        | { readonly ok: false; readonly code: string };
      if (!res.ok || !payload.ok) {
        const code = !payload.ok ? payload.code : "TICKET_MESSAGE_FAILED";
        onError(mapOperatorTicketsMutationErrorCode(code));
        return;
      }
      setBody("");
      idempotencyRef.current = null;
      onDetailUpdated(payload.detail);
    } catch {
      onError("generic");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      data-operator-tickets-composer
      data-operator-tickets-composer-mode={mode}
      data-testid={OPERATOR_TICKETS_TEST_IDS.composer}
      className="sticky bottom-0 border-t border-border bg-background/95 p-3 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mb-2 flex flex-wrap gap-2" role="tablist" aria-label={t("composerModeAria")}>
        <Button
          type="button"
          role="tab"
          size="sm"
          variant={mode === "public" ? "default" : "outline"}
          aria-selected={mode === "public"}
          onClick={() => setMode("public")}
        >
          {t("composerPublic")}
        </Button>
        <Button
          type="button"
          role="tab"
          size="sm"
          variant={mode === "internal" ? "default" : "outline"}
          aria-selected={mode === "internal"}
          onClick={() => setMode("internal")}
        >
          {t("composerInternal")}
        </Button>
      </div>
      {mode === "public" && templates.length > 0 ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="operator-ticket-template-picker">
            {t("templatePickerLabel")}
          </label>
          <select
            id="operator-ticket-template-picker"
            data-testid={OPERATOR_TICKETS_TEST_IDS.templatePicker}
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
            value={selectedTemplateCode}
            onChange={(event) => setSelectedTemplateCode(event.target.value)}
          >
            <option value="">{t("templatePickerPlaceholder")}</option>
            {templates.map((template) => (
              <option key={`${template.code}-${template.locale}`} value={template.code}>
                {template.title}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedTemplateCode.length === 0}
            onClick={() => void applyTemplate()}
          >
            {t("templateInsert")}
          </Button>
        </div>
      ) : null}
      <label className="sr-only" htmlFor="operator-ticket-composer-body">
        {mode === "public" ? t("composerPublic") : t("composerInternal")}
      </label>
      <textarea
        id="operator-ticket-composer-body"
        value={body}
        rows={3}
        disabled={pending}
        className="mb-2 w-full min-w-0 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
        placeholder={mode === "public" ? t("composerPublicPlaceholder") : t("composerInternalPlaceholder")}
        onChange={(event) => setBody(event.target.value)}
      />
      <Button type="button" disabled={pending || body.trim().length === 0} onClick={() => void submit()}>
        {pending ? t("sending") : t("send")}
      </Button>
    </div>
  );
}
