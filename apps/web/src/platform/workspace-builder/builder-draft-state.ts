import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import {
  PLATFORM_GENERIC_RENDERER_IDS,
  stripWorkspacePluginToDefinitionPayload,
  type WorkspaceDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";
import type { WorkspaceFieldKind, WorkspaceFieldRegistryEntry } from "@app-tour/workspace-sdk";

export const BUILDER_SESSION_STORAGE_PREFIX = "platform-builder:";
export const BUILDER_MAX_SIMPLE_RULES = 20;

export type BuilderSimpleRule = {
  readonly id: string;
  readonly when: {
    readonly fieldId: string;
    readonly operator: "eq" | "neq";
    readonly value: string;
  };
  readonly effect: {
    readonly type: "hidden" | "required" | "disabled";
    readonly targetFieldId: string;
  };
};

export type BuilderDraftMeta = {
  readonly basedOnVersion: number | null;
  readonly editedAt: string;
};

export type BuilderDraft = {
  readonly payload: WorkspaceDefinitionPayload;
  readonly meta: BuilderDraftMeta;
  readonly simpleRules: readonly BuilderSimpleRule[];
  readonly activeStepId: string;
  readonly selectedFieldId: string | null;
};

export type BuilderDraftAction =
  | { readonly type: "replace"; readonly draft: BuilderDraft }
  | { readonly type: "setActiveStep"; readonly stepId: string }
  | { readonly type: "selectField"; readonly fieldId: string | null }
  | { readonly type: "addPrimitiveField"; readonly kind: WorkspaceFieldKind }
  | { readonly type: "addCompositeField"; readonly rendererId: string }
  | { readonly type: "updateField"; readonly fieldId: string; readonly patch: Partial<WorkspaceFieldRegistryEntry> }
  | { readonly type: "removeField"; readonly fieldId: string }
  | { readonly type: "moveField"; readonly fieldId: string; readonly direction: "up" | "down" }
  | { readonly type: "addSimpleRule"; readonly rule: BuilderSimpleRule }
  | { readonly type: "removeSimpleRule"; readonly ruleId: string };

export const BUILDER_PRIMITIVE_PALETTE: readonly {
  readonly kind: WorkspaceFieldKind;
  readonly label: string;
}[] = [
  { kind: "text", label: "Text" },
  { kind: "number", label: "Number" },
  { kind: "boolean", label: "Boolean" },
  { kind: "enum", label: "Enum" },
  { kind: "date", label: "Date" },
];

export const BUILDER_COMPOSITE_PALETTE = PLATFORM_GENERIC_RENDERER_IDS.map((id) => ({
  id,
  label: id.replace("platform.", ""),
}));

let fieldSequence = 0;

function nextFieldSlug(prefix: string): string {
  fieldSequence += 1;
  return `${prefix}.${fieldSequence}`;
}

function touchMeta(meta: BuilderDraftMeta): BuilderDraftMeta {
  return {
    ...meta,
    editedAt: new Date().toISOString(),
  };
}

export function createInitialBuilderPayload(definitionId: string): WorkspaceDefinitionPayload {
  const base = stripWorkspacePluginToDefinitionPayload(getStarterWorkspacePlugin());
  return {
    ...base,
    id: definitionId,
  };
}

export function createInitialBuilderDraft(input: {
  readonly definitionId: string;
  readonly basedOnVersion: number | null;
  readonly payload?: WorkspaceDefinitionPayload;
}): BuilderDraft {
  const payload = input.payload ?? createInitialBuilderPayload(input.definitionId);
  const activeStepId = payload.wizard.roots[0] ?? "basics";
  return {
    payload,
    meta: {
      basedOnVersion: input.basedOnVersion,
      editedAt: new Date().toISOString(),
    },
    simpleRules: [],
    activeStepId,
    selectedFieldId: payload.fieldRegistry.fields[0]?.id ?? null,
  };
}

export function builderSessionStorageKey(definitionId: string): string {
  return `${BUILDER_SESSION_STORAGE_PREFIX}${definitionId}`;
}

export function readBuilderDraftFromSessionStorage(definitionId: string): BuilderDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(builderSessionStorageKey(definitionId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as BuilderDraft;
  } catch {
    return null;
  }
}

export function writeBuilderDraftToSessionStorage(definitionId: string, draft: BuilderDraft): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(builderSessionStorageKey(definitionId), JSON.stringify(draft));
}

export function clearBuilderDraftSessionStorage(definitionId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(builderSessionStorageKey(definitionId));
}

export function findDuplicateFieldIds(payload: WorkspaceDefinitionPayload): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const field of payload.fieldRegistry.fields) {
    if (seen.has(field.id)) {
      duplicates.add(field.id);
    }
    seen.add(field.id);
  }
  return [...duplicates];
}

export function createPrimitiveField(
  kind: WorkspaceFieldKind,
  activeStepId: string
): WorkspaceFieldRegistryEntry {
  const slug = nextFieldSlug(kind);
  return {
    id: slug,
    canonicalPath: slug,
    stepId: activeStepId,
    kind,
    required: false,
    ...(kind === "enum" ? { enumOptions: ["option_a", "option_b"] } : {}),
  };
}

export function createCompositeField(
  rendererId: string,
  activeStepId: string
): WorkspaceFieldRegistryEntry {
  const canonicalPath = rendererId.startsWith("platform.")
    ? rendererId.slice("platform.".length)
    : rendererId;
  return {
    id: rendererId,
    canonicalPath,
    stepId: activeStepId,
    kind: "composite",
    required: false,
  };
}

function reorderFields(
  fields: readonly WorkspaceFieldRegistryEntry[],
  fieldId: string,
  direction: "up" | "down"
): readonly WorkspaceFieldRegistryEntry[] {
  const index = fields.findIndex((field) => field.id === fieldId);
  if (index < 0) {
    return fields;
  }
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= fields.length) {
    return fields;
  }
  const next = [...fields];
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item!);
  return next;
}

export function reduceBuilderDraft(
  state: BuilderDraft,
  action: BuilderDraftAction
): BuilderDraft {
  switch (action.type) {
    case "replace":
      return action.draft;
    case "setActiveStep":
      return { ...state, activeStepId: action.stepId };
    case "selectField":
      return { ...state, selectedFieldId: action.fieldId };
    case "addPrimitiveField": {
      const field = createPrimitiveField(action.kind, state.activeStepId);
      return {
        ...state,
        meta: touchMeta(state.meta),
        payload: {
          ...state.payload,
          fieldRegistry: {
            ...state.payload.fieldRegistry,
            fields: [...state.payload.fieldRegistry.fields, field],
          },
        },
        selectedFieldId: field.id,
      };
    }
    case "addCompositeField": {
      const field = createCompositeField(action.rendererId, state.activeStepId);
      return {
        ...state,
        meta: touchMeta(state.meta),
        payload: {
          ...state.payload,
          fieldRegistry: {
            ...state.payload.fieldRegistry,
            fields: [...state.payload.fieldRegistry.fields, field],
          },
        },
        selectedFieldId: field.id,
      };
    }
    case "updateField": {
      const fields = state.payload.fieldRegistry.fields.map((field) =>
        field.id === action.fieldId ? { ...field, ...action.patch } : field
      );
      return {
        ...state,
        meta: touchMeta(state.meta),
        payload: {
          ...state.payload,
          fieldRegistry: {
            ...state.payload.fieldRegistry,
            fields,
          },
        },
      };
    }
    case "removeField": {
      const fields = state.payload.fieldRegistry.fields.filter((field) => field.id !== action.fieldId);
      return {
        ...state,
        meta: touchMeta(state.meta),
        payload: {
          ...state.payload,
          fieldRegistry: {
            ...state.payload.fieldRegistry,
            fields,
          },
        },
        selectedFieldId:
          state.selectedFieldId === action.fieldId ? (fields[0]?.id ?? null) : state.selectedFieldId,
      };
    }
    case "moveField": {
      const fields = reorderFields(state.payload.fieldRegistry.fields, action.fieldId, action.direction);
      return {
        ...state,
        meta: touchMeta(state.meta),
        payload: {
          ...state.payload,
          fieldRegistry: {
            ...state.payload.fieldRegistry,
            fields,
          },
        },
      };
    }
    case "addSimpleRule":
      if (state.simpleRules.length >= BUILDER_MAX_SIMPLE_RULES) {
        return state;
      }
      return {
        ...state,
        meta: touchMeta(state.meta),
        simpleRules: [...state.simpleRules, action.rule],
      };
    case "removeSimpleRule":
      return {
        ...state,
        meta: touchMeta(state.meta),
        simpleRules: state.simpleRules.filter((rule) => rule.id !== action.ruleId),
      };
    default:
      return state;
  }
}
