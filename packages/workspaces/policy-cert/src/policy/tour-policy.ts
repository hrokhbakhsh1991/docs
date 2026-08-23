import type {
  WorkspacePolicyValidator,
  WorkspaceValidationPipelineContext,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

const RULE_TITLE_MIN_LENGTH = "POLICY_CERT_TITLE_TOO_SHORT";
const RULE_BLOCKED_WORD = "POLICY_CERT_BLOCKED_WORD";

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
  if (title != null && title.length < 3) {
    return {
      code: RULE_TITLE_MIN_LENGTH,
      message: "Title must be at least 3 characters",
    };
  }
  return null;
}

function ruleBlockedWord(ctx: WorkspaceValidationPipelineContext): WorkspaceViolation | null {
  const title = readBasicsTitle(ctx);
  if (title != null && title.toLowerCase().includes("blocked")) {
    return {
      code: RULE_BLOCKED_WORD,
      message: "Title contains blocked word",
    };
  }
  return null;
}

/** CW8-03 proof — two ordered custom rules via manifest policy module. */
export function createTourWorkspacePolicyValidator(): WorkspacePolicyValidator {
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
