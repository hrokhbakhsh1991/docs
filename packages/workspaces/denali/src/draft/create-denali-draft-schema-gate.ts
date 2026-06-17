import type { DraftSchemaGate, DraftSchemaIssue } from "@app-tour/draft-engine";
import type { ZodError } from "zod";

import type { DenaliWizardRuleEvalContext } from "../wizard/denali-wizard-rule-eval-context";
import { sanitizeDenaliWizardDraftRecord } from "../wizard/denali-wizard-draft-sanitize";
import type { DenaliWizardRulesModule } from "../wizard/denali-wizard-rules-module";

import type { DenaliWizardDraftEnvelope } from "./denali-wizard-draft-binding";
import {
  DenaliWizardDraftEnvelopeSchema,
  MAX_SANITY_ATTEMPTS,
  type ParsedDenaliWizardDraftEnvelope,
} from "./denali-wizard-draft-schema";

function zodIssuesToSchemaIssues(error: ZodError): readonly DraftSchemaIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.map(String),
    message: issue.message,
  }));
}

function stableEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeForGate<TForm>(
  envelope: DenaliWizardDraftEnvelope<TForm>
): DenaliWizardDraftEnvelope<TForm> {
  if (envelope.meta.freshStart !== true) {
    return envelope;
  }
  const { deletedRoots: _removed, ...metaRest } = envelope.meta;
  return {
    form: envelope.form,
    meta: { ...metaRest, freshStart: true },
  };
}

function sanitizeEnvelopeForm<TForm extends { readonly data: Record<string, unknown> }>(
  envelope: ParsedDenaliWizardDraftEnvelope,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext
): ParsedDenaliWizardDraftEnvelope {
  const sanitizedForm = sanitizeDenaliWizardDraftRecord(
    envelope.form as Record<string, unknown>,
    rules,
    evalContext
  ) as TForm;
  return {
    form: sanitizedForm,
    meta: envelope.meta,
  };
}

function runMergePhaseGate<TForm extends { readonly data: Record<string, unknown> }>(
  candidate: DenaliWizardDraftEnvelope<TForm>,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext
): ReturnType<DraftSchemaGate<DenaliWizardDraftEnvelope<TForm>>> {
  let current: unknown = normalizeForGate(candidate);

  for (let attempt = 1; attempt <= MAX_SANITY_ATTEMPTS; attempt++) {
    const parsed = DenaliWizardDraftEnvelopeSchema.safeParse(current);
    if (!parsed.success) {
      return { ok: false, issues: zodIssuesToSchemaIssues(parsed.error) };
    }

    const sanitized = sanitizeEnvelopeForm<TForm>(parsed.data, rules, evalContext);
    const reparsed = DenaliWizardDraftEnvelopeSchema.safeParse(sanitized);
    if (!reparsed.success) {
      return { ok: false, issues: zodIssuesToSchemaIssues(reparsed.error) };
    }

    if (stableEqual(parsed.data, reparsed.data)) {
      return { ok: true, value: reparsed.data as DenaliWizardDraftEnvelope<TForm> };
    }

    current = reparsed.data;
  }

  console.warn("[denali-draft-gate] SANITIZE_FIXPOINT_EXCEEDED", {
    attempts: MAX_SANITY_ATTEMPTS,
  });
  return { ok: false, issues: [{ code: "SANITIZE_FIXPOINT_EXCEEDED" }] };
}

export function createDenaliDraftSchemaGate<TForm extends { readonly data: Record<string, unknown> }>(
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext
): DraftSchemaGate<DenaliWizardDraftEnvelope<TForm>> {
  return (candidate, ctx) => {
    if (ctx.phase !== "prePush" && ctx.phase !== "merge") {
      return { ok: false, issues: [{ code: "INVALID_SCHEMA_PHASE" }] };
    }

    const normalized = normalizeForGate(candidate);

    if (ctx.phase === "prePush") {
      const parsed = DenaliWizardDraftEnvelopeSchema.safeParse(normalized);
      if (!parsed.success) {
        return { ok: false, issues: zodIssuesToSchemaIssues(parsed.error) };
      }
      return { ok: true, value: normalized };
    }

    return runMergePhaseGate(normalized, rules, evalContext);
  };
}
