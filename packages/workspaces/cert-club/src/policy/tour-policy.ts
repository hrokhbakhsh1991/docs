import type {
  WorkspacePolicyValidator,
  WorkspaceValidationPipelineContext,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

const RULE_TITLE_MIN_LENGTH = "CERT_CLUB_TITLE_TOO_SHORT";
const RULE_BLOCKED_WORD = "CERT_CLUB_BLOCKED_WORD";

function readBasicsTitle(ctx: WorkspaceValidationPipelineContext): string | undefined {
  const basics = (ctx.document.data as Record<string, unknown>).basics;
  if (typeof basics !== "object" || basics === null) {
    return undefined;
  }
  const title = (basics as Record<string, unknown>).title;
  return typeof title === "string" ? title : undefined;
}

function ruleTitleMinLength(ctx: WorkspaceValidationPipelineContext): WorkspaceViolation | null {
  const title = readBasicsTitle(ctx);
  if (title != null && title.length < 4) {
    return {
      code: RULE_TITLE_MIN_LENGTH,
      message: "Cert club title must be at least 4 characters",
    };
  }
  return null;
}

function ruleBlockedWord(ctx: WorkspaceValidationPipelineContext): WorkspaceViolation | null {
  const title = readBasicsTitle(ctx);
  if (title != null && title.toLowerCase().includes("forbidden")) {
    return {
      code: RULE_BLOCKED_WORD,
      message: "Title contains forbidden word",
    };
  }
  return null;
}

/** CW9-03 — two synthetic workspace policy rules via CW8-03 seam. */
export function createCertClubTourWorkspacePolicyValidator(): WorkspacePolicyValidator {
  return Object.freeze({
    validate(ctx: WorkspaceValidationPipelineContext): WorkspaceViolation | null {
      const first = ruleTitleMinLength(ctx);
      if (first != null) {
        return first;
      }
      return ruleBlockedWord(ctx);
    },
  });
}
