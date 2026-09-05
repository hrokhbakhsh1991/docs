import { randomUUID } from "node:crypto";

import { resolveStorageDriver } from "../storage/production-storage-driver-assert";

import { NATIVE_EXPOSURE_INTENT_SOURCE, type ExposureIntent } from "./exposure-intent";
import {
  exposureIntentContextLookupKey,
  normalizeExposureIntentScope,
  type ExposureIntentContextKey,
  type ExposureIntentRepository,
  type UpsertExposureIntentInput,
} from "./exposure-intent.repository";
import { PrismaExposureIntentRepository } from "./prisma-exposure-intent.repository";

type StoreKey = string;

function storeKey(input: ExposureIntentContextKey): StoreKey {
  return `${input.tenantId}|${exposureIntentContextLookupKey(input)}`;
}

let intentStore = new Map<StoreKey, ExposureIntent>();

export function resetExposureIntentRepositoryForTests(): void {
  intentStore = new Map();
}

export class InMemoryExposureIntentRepository implements ExposureIntentRepository {
  async findForContext(input: ExposureIntentContextKey): Promise<ExposureIntent | null> {
    const scope = normalizeExposureIntentScope(input.scope);
    const key = storeKey({ ...input, scope });
    const row = intentStore.get(key);
    return row === undefined ? null : structuredClone(row);
  }

  async findForContexts(
    contexts: readonly ExposureIntentContextKey[]
  ): Promise<ReadonlyMap<string, ExposureIntent>> {
    const lookup = new Map<string, ExposureIntent>();
    for (const context of contexts) {
      const intent = await this.findForContext(context);
      if (intent !== null) {
        lookup.set(exposureIntentContextLookupKey(context), intent);
      }
    }
    return lookup;
  }

  async listForConnectionScope(_input: {
    readonly tenantId: string;
    readonly connectionId: string;
  }): Promise<readonly ExposureIntent[]> {
    return [];
  }

  async listForConnectionScopes(_input: {
    readonly tenantId: string;
    readonly connectionIds: readonly string[];
  }): Promise<ReadonlyMap<string, readonly ExposureIntent[]>> {
    return new Map();
  }

  async upsert(input: UpsertExposureIntentInput): Promise<ExposureIntent> {
    const scope = normalizeExposureIntentScope(input.scope);
    const contextKey: ExposureIntentContextKey = {
      tenantId: input.tenantId,
      profileId: input.profileId,
      surface: input.surface,
      audience: input.audience,
      trigger: input.trigger,
      scope,
    };
    const key = storeKey(contextKey);
    const now = new Date().toISOString();
    const existing = intentStore.get(key);
    const id = existing?.id ?? randomUUID();
    const selectedFieldIds =
      input.mode === "override_fields" ? [...(input.selectedFieldIds ?? [])] : [];
    const intent: ExposureIntent = Object.freeze({
      id,
      profileId: input.profileId,
      workspaceType: input.workspaceType ?? "",
      entityType: input.entityType,
      surface: input.surface,
      audience: input.audience,
      trigger: input.trigger,
      scope,
      mode: input.mode,
      selectedFieldIds,
      ...(input.fieldDecorations == null ? {} : { fieldDecorations: input.fieldDecorations }),
      ...(input.templateOverrideId === undefined || input.templateOverrideId === null
        ? {}
        : { templateOverrideId: input.templateOverrideId }),
      source: NATIVE_EXPOSURE_INTENT_SOURCE,
      sourceId: id,
      version: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    intentStore.set(key, intent);
    return structuredClone(intent);
  }
}

export function createExposureIntentRepository(): ExposureIntentRepository {
  if (resolveStorageDriver() === "prisma") {
    return new PrismaExposureIntentRepository();
  }
  return new InMemoryExposureIntentRepository();
}
