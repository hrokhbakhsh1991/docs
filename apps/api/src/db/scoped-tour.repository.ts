import type { ApiAbility } from "../casl/api-ability";
import { accessibleByTourWhere, type TourAction } from "../casl/api-ability";
import type { TourListPageInput, TourListPageResult, TourRecord, TourWhere } from "./tour-record";
import type { TourRepository, TourStorageRepository } from "./tour.repository";

function mergeWhere(
  ability: ApiAbility,
  action: TourAction,
  where?: Partial<TourWhere>
): TourWhere {
  const scoped = accessibleByTourWhere(ability, action);
  return {
    tenantId: scoped.tenantId,
    id: where?.id,
  };
}

/**
 * Repository facade — every method injects accessibleBy-style tenant scope.
 */
export class ScopedTourRepository implements TourRepository {
  constructor(
    private readonly inner: TourStorageRepository,
    private readonly ability: ApiAbility
  ) {}

  findMany(extra?: Partial<TourWhere>): Promise<readonly TourRecord[]> {
    return this.inner.findMany(mergeWhere(this.ability, "read", extra));
  }

  listPage(
    extra: Partial<TourWhere> | undefined,
    page: TourListPageInput
  ): Promise<TourListPageResult> {
    return this.inner.listPage(mergeWhere(this.ability, "read", extra), page);
  }

  async findFirst(extra?: Partial<TourWhere>): Promise<TourRecord | null> {
    const scoped = accessibleByTourWhere(this.ability, "read");

    if (extra?.id !== undefined) {
      return this.inner.findFirst({ tenantId: scoped.tenantId, id: extra.id });
    }

    return this.inner.findFirst(mergeWhere(this.ability, "read", extra));
  }

  create(data: { tenantId: string; canonical: TourRecord["canonical"] }): Promise<TourRecord> {
    const scoped = accessibleByTourWhere(this.ability, "create");
    if (data.tenantId !== scoped.tenantId) {
      throw new Error("FORBIDDEN_TOUR_CREATE_CROSS_TENANT");
    }
    return this.inner.create(data);
  }

  update(data: {
    tenantId: string;
    id: string;
    canonical: TourRecord["canonical"];
    expectedRowVersion: number;
  }): Promise<TourRecord> {
    const scoped = accessibleByTourWhere(this.ability, "update");
    if (data.tenantId !== scoped.tenantId) {
      throw new Error("FORBIDDEN_TOUR_UPDATE_CROSS_TENANT");
    }
    return this.inner.update(data);
  }
}
