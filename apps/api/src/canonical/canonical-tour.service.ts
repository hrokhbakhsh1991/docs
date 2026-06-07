import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import type { ApiAbility } from "../casl/api-ability";
import { accessibleByTourWhere } from "../casl/api-ability";
import { ScopedTourRepository } from "../db/scoped-tour.repository";
import type { TourRecord } from "../db/tour-record";
import type { TourStorageRepository } from "../db/tour.repository";
import type { ListToursQuery, TourListItem, TourListResult } from "../tours/list-tours-query";
import type { CreateTourBody } from "../tours/create-tour.schema";
import type { UpdateTourBody } from "../tours/update-tour.schema";
import { useAtomicCanonicalPersist } from "../storage/create-tour-storage";
import {
  getActiveTenantId,
  requireActiveTenantId,
  runWithTenantContext,
} from "../tenant/tenant-request-context";

function mergeCanonicalPatchData(
  existing: CreateTourBody["data"],
  patch: UpdateTourBody["data"] | undefined
): CreateTourBody["data"] {
  if (patch === undefined) {
    return existing;
  }
  const merged: Record<string, unknown> = { ...(existing as Record<string, unknown>) };
  for (const [root, patchRoot] of Object.entries(patch)) {
    const existingRoot = merged[root];
    if (
      patchRoot !== null &&
      typeof patchRoot === "object" &&
      !Array.isArray(patchRoot) &&
      existingRoot !== null &&
      typeof existingRoot === "object" &&
      !Array.isArray(existingRoot)
    ) {
      merged[root] = { ...(existingRoot as Record<string, unknown>), ...patchRoot };
      continue;
    }
    merged[root] = patchRoot;
  }
  return merged as CreateTourBody["data"];
}

function assertCanonicalWriteTenantAllowed(requestedTenantId: string): void {
  const bound = getActiveTenantId();
  const target = requestedTenantId.trim();
  if (bound !== undefined && bound !== target) {
    throw new Error("CANONICAL_WRITE_TENANT_MISMATCH");
  }
}
import { recordTourCreated } from "../observability/metrics";
import { publishTourCreatedEvent } from "./publish-tour-created";
import {
  persistNewTourAtomically,
  persistTourUpdateAtomically,
} from "./atomic-canonical-tour-persist";
import { CanonicalSyncValidationError } from "./canonical-sync-validation-error";
import { validateCanonicalLegacySync } from "./canonical-sync-validator";
import { LegacyCanonicalAdapter } from "./legacy-canonical-adapter";
import {
  awaitPreTransactionValidationDelayForTests,
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "./pre-transaction-validation";
import { PHASE_32_CANONICAL_STORAGE } from "./canonical-storage";

export type CanonicalTourWriteInput = {
  readonly ability: ApiAbility;
  readonly tenantId: string;
  readonly body: CreateTourBody;
  readonly workspaceType: string;
  readonly validationVariant?: "default" | "basic";
  readonly actorId?: string;
};

/**
 * Canonical Service — single write path to {@link PHASE_32_CANONICAL_STORAGE}.
 * Legacy access is redirected through {@link LegacyCanonicalAdapter} (read-only / no dual-write).
 */
export class CanonicalTourService {
  constructor(
    private readonly canonicalStore: TourStorageRepository,
    private readonly legacyAdapter: LegacyCanonicalAdapter
  ) {}

  async writeTour(input: CanonicalTourWriteInput): Promise<TourRecord> {
    assertCanonicalWriteTenantAllowed(input.tenantId);
    return runWithTenantContext(input.tenantId, () => this.writeTourInActiveContext(input), {
      actorId: input.actorId,
      workspaceType: input.workspaceType,
    });
  }

  private async writeTourInActiveContext(input: CanonicalTourWriteInput): Promise<TourRecord> {
    const activeTenant = requireActiveTenantId();
    if (activeTenant !== input.tenantId.trim()) {
      throw new Error("CANONICAL_WRITE_TENANT_MISMATCH");
    }
    accessibleByTourWhere(input.ability, "create");

    let canonical;
    try {
      canonical = await runPreTransactionValidation({
        body: input.body,
        tenantId: input.tenantId,
        workspaceType: input.workspaceType,
        validationVariant: input.validationVariant,
      });
      await awaitPreTransactionValidationDelayForTests();

      const record = useAtomicCanonicalPersist()
        ? await this.persistViaCanonicalTransaction(input.tenantId, canonical)
        : await this.persistViaScopedRepository(input, canonical);

      const sync = validateCanonicalLegacySync({
        canonicalRecords: [record],
        legacyRecords: this.legacyAdapter.listMirroredTours(),
      });
      if (!sync.ok) {
        throw new CanonicalSyncValidationError();
      }

      recordTourCreated(record.tenantId);

      if (!useAtomicCanonicalPersist()) {
        publishTourCreatedEvent({
          tenantId: record.tenantId,
          tourId: record.id,
        });
      }

      return record;
    } finally {
      clearPreTransactionValidationGate(input.tenantId);
    }
  }

  private async persistViaCanonicalTransaction(
    tenantId: string,
    canonical: CanonicalDocument
  ): Promise<TourRecord> {
    const persisted = await persistNewTourAtomically({ tenantId, canonical });
    return {
      id: persisted.id,
      tenantId: persisted.tenantId,
      canonical: persisted.canonical,
      createdAt: persisted.createdAt,
      rowVersion: 1,
    };
  }

  private async persistViaScopedRepository(
    input: CanonicalTourWriteInput,
    canonical: CanonicalDocument
  ): Promise<TourRecord> {
    const scopedRepo = new ScopedTourRepository(this.canonicalStore, input.ability);
    return scopedRepo.create({
      tenantId: input.tenantId,
      canonical,
    });
  }

  async readTourById(ability: ApiAbility, tourId: string): Promise<TourRecord | null> {
    accessibleByTourWhere(ability, "read");
    const scopedRepo = new ScopedTourRepository(this.canonicalStore, ability);
    return scopedRepo.findFirst({ id: tourId });
  }

  async listTours(ability: ApiAbility, options: ListToursQuery): Promise<TourListResult> {
    accessibleByTourWhere(ability, "read");
    const scopedRepo = new ScopedTourRepository(this.canonicalStore, ability);
    const page = await scopedRepo.listPage({}, { limit: options.limit, cursor: options.cursor });
    return {
      items: page.items.map(toTourListItem),
      nextCursor: page.nextCursor,
    };
  }

  async updateTour(input: {
    readonly ability: ApiAbility;
    readonly tenantId: string;
    readonly tourId: string;
    readonly body: UpdateTourBody;
    readonly workspaceType: string;
    readonly validationVariant?: "default" | "basic";
    readonly actorId?: string;
  }): Promise<TourRecord> {
    assertCanonicalWriteTenantAllowed(input.tenantId);
    return runWithTenantContext(input.tenantId, () => this.updateTourInActiveContext(input), {
      actorId: input.actorId,
      workspaceType: input.workspaceType,
    });
  }

  private async updateTourInActiveContext(input: {
    readonly ability: ApiAbility;
    readonly tenantId: string;
    readonly tourId: string;
    readonly body: UpdateTourBody;
    readonly workspaceType: string;
    readonly validationVariant?: "default" | "basic";
  }): Promise<TourRecord> {
    const activeTenant = requireActiveTenantId();
    if (activeTenant !== input.tenantId.trim()) {
      throw new Error("CANONICAL_WRITE_TENANT_MISMATCH");
    }
    accessibleByTourWhere(input.ability, "update");

    const scopedRepo = new ScopedTourRepository(this.canonicalStore, input.ability);
    const existing = await scopedRepo.findFirst({ id: input.tourId });
    if (existing === null) {
      throw new Error("TOUR_NOT_FOUND");
    }

    const mergeBody: CreateTourBody = {
      schemaVersion: input.body.schemaVersion ?? existing.canonical.schemaVersion,
      roots: input.body.roots ?? [...existing.canonical.roots],
      data:
        input.workspaceType === "urban"
          ? mergeCanonicalPatchData(existing.canonical.data, input.body.data)
          : ((input.body.data ?? existing.canonical.data) as CreateTourBody["data"]),
    };

    const canonical = await runPreTransactionValidation({
      body: mergeBody,
      tenantId: input.tenantId,
      workspaceType: input.workspaceType,
      validationVariant: input.validationVariant,
    });

    try {
      if (useAtomicCanonicalPersist()) {
        const updated = await persistTourUpdateAtomically({
          tenantId: input.tenantId,
          tourId: input.tourId,
          canonical,
          expectedRowVersion: input.body.rowVersion,
        });
        return {
          id: updated.id,
          tenantId: updated.tenantId,
          canonical: updated.canonical,
          createdAt: updated.createdAt,
          rowVersion: updated.rowVersion,
        };
      }

      return await scopedRepo.update({
        tenantId: input.tenantId,
        id: input.tourId,
        canonical,
        expectedRowVersion: input.body.rowVersion,
      });
    } finally {
      clearPreTransactionValidationGate(input.tenantId);
    }
  }
}

function toTourListItem(record: TourRecord): TourListItem {
  return {
    id: record.id,
    tenantId: record.tenantId,
    createdAt: record.createdAt,
    rowVersion: record.rowVersion,
  };
}
