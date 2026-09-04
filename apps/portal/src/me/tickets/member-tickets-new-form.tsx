"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { MemberTicketCategoriesView } from "@/me/tickets/member-tickets-bff.server";

import { MemberTicketAttachmentField } from "./member-ticket-attachment-field";

type Props = {
  readonly categories: MemberTicketCategoriesView;
};

type FormState = {
  readonly categoryCode: string;
  readonly subject: string;
  readonly body: string;
  readonly relatedTourId: string;
  readonly relatedRegistrationId: string;
};

const STORAGE_KEY = "portal-member-ticket-draft-v1";

function readDraft(): Partial<FormState> | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw === null ? null : (JSON.parse(raw) as Partial<FormState>);
  } catch {
    return null;
  }
}

function writeDraft(state: FormState): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ticket-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function MemberTicketsNewForm({ categories }: Props) {
  const t = useTranslations("portalMember.tickets");
  const router = useRouter();
  const formId = useId();
  const subjectId = `${formId}-subject`;
  const bodyId = `${formId}-body`;
  const categoryId = `${formId}-category`;
  const tourId = `${formId}-tour`;
  const registrationId = `${formId}-registration`;
  const errorRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [state, setState] = useState<FormState>(() => ({
    categoryCode: categories.defaultCategoryCode,
    subject: "",
    body: "",
    relatedTourId: "",
    relatedRegistrationId: "",
    ...readDraft(),
  }));

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    dirtyRef.current = true;
    setState((current) => {
      const next = { ...current, [key]: value };
      writeDraft(next);
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (state.subject.trim().length < 3) {
      errors.subject = t("validation.subject");
    }
    if (state.body.trim().length < 1) {
      errors.body = t("validation.body");
    }
    if (!categories.categories.some((category) => category.code === state.categoryCode)) {
      errors.categoryCode = t("validation.category");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [categories.categories, state.body, state.categoryCode, state.subject, t]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clientReady || submitting) {
      return;
    }
    setFormError(null);
    if (!validate()) {
      errorRef.current?.focus();
      return;
    }

    setSubmitting(true);
    const idempotencyKey = createIdempotencyKey();
    const payload = {
      categoryCode: state.categoryCode,
      subject: state.subject.trim(),
      body: state.body.trim(),
      ...(state.relatedTourId.trim().length > 0
        ? { relatedTourId: state.relatedTourId.trim() }
        : {}),
      ...(state.relatedRegistrationId.trim().length > 0
        ? { relatedRegistrationId: state.relatedRegistrationId.trim() }
        : {}),
    };

    try {
      const res = await fetch("/api/me/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof body?.code === "string" ? body.code : "TICKET_CREATE_FAILED";
        setFormError(typeof body?.message === "string" ? body.message : t(`errors.${code}`, { defaultValue: t("createError") }));
        setSubmitting(false);
        errorRef.current?.focus();
        return;
      }

      const ticketId =
        typeof body?.ticket?.ticket?.id === "string"
          ? body.ticket.ticket.id
          : null;

      if (ticketId === null) {
        setFormError(t("createError"));
        setSubmitting(false);
        return;
      }

      dirtyRef.current = false;
      clearDraft();
      router.push(`/me/tickets/${ticketId}`);
      router.refresh();
    } catch {
      setFormError(t("createError"));
      setSubmitting(false);
      errorRef.current?.focus();
    }
  };

  return (
    <form
      data-portal-member-tickets-new-form
      data-client-ready={clientReady ? "true" : undefined}
      onSubmit={onSubmit}
      noValidate
      aria-describedby={formError !== null ? `${formId}-error` : undefined}
    >
      {formError !== null ? (
        <div
          id={`${formId}-error`}
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          data-portal-member-tickets-form-error
        >
          {formError}
        </div>
      ) : null}

      <div data-portal-member-tickets-field>
        <label htmlFor={categoryId}>{t("fields.category")}</label>
        <select
          id={categoryId}
          name="categoryCode"
          value={state.categoryCode}
          aria-invalid={fieldErrors.categoryCode !== undefined}
          aria-describedby={fieldErrors.categoryCode ? `${categoryId}-error` : undefined}
          onChange={(event) => updateField("categoryCode", event.target.value)}
        >
          {categories.categories.map((category) => (
            <option key={category.code} value={category.code}>
              {t(`categories.${category.code}`)}
            </option>
          ))}
        </select>
        {fieldErrors.categoryCode ? (
          <p id={`${categoryId}-error`} role="alert">
            {fieldErrors.categoryCode}
          </p>
        ) : null}
      </div>

      <div data-portal-member-tickets-field>
        <label htmlFor={subjectId}>{t("fields.subject")}</label>
        <input
          id={subjectId}
          name="subject"
          type="text"
          autoComplete="off"
          value={state.subject}
          aria-invalid={fieldErrors.subject !== undefined}
          aria-describedby={fieldErrors.subject ? `${subjectId}-error` : undefined}
          onChange={(event) => updateField("subject", event.target.value)}
        />
        {fieldErrors.subject ? (
          <p id={`${subjectId}-error`} role="alert">
            {fieldErrors.subject}
          </p>
        ) : null}
      </div>

      <div data-portal-member-tickets-field>
        <label htmlFor={bodyId}>{t("fields.body")}</label>
        <textarea
          id={bodyId}
          name="body"
          rows={6}
          value={state.body}
          aria-invalid={fieldErrors.body !== undefined}
          aria-describedby={fieldErrors.body ? `${bodyId}-error` : undefined}
          onChange={(event) => updateField("body", event.target.value)}
        />
        {fieldErrors.body ? (
          <p id={`${bodyId}-error`} role="alert">
            {fieldErrors.body}
          </p>
        ) : null}
      </div>

      <details
        data-portal-member-tickets-advanced
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
      >
        <summary>{t("advancedSectionToggle")}</summary>
        <p data-portal-member-tickets-advanced-hint>{t("advancedSectionHint")}</p>
        <div data-portal-member-tickets-field>
          <label htmlFor={tourId}>{t("fields.relatedTourId")}</label>
          <input
            id={tourId}
            name="relatedTourId"
            type="text"
            inputMode="text"
            autoComplete="off"
            value={state.relatedTourId}
            onChange={(event) => updateField("relatedTourId", event.target.value)}
          />
        </div>

        <div data-portal-member-tickets-field>
          <label htmlFor={registrationId}>{t("fields.relatedRegistrationId")}</label>
          <input
            id={registrationId}
            name="relatedRegistrationId"
            type="text"
            inputMode="text"
            autoComplete="off"
            value={state.relatedRegistrationId}
            onChange={(event) => updateField("relatedRegistrationId", event.target.value)}
          />
        </div>
      </details>

      {categories.attachmentsEnabled ? (
        <MemberTicketAttachmentField
          mode="create"
          ticketId={null}
          messageId={pendingMessageId}
          maxBytes={categories.maxAttachmentSizeBytes}
          onMessageId={setPendingMessageId}
        />
      ) : null}

      <div data-portal-member-tickets-form-actions>
        <button type="submit" disabled={!clientReady || submitting} aria-busy={submitting}>
          {submitting ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}
