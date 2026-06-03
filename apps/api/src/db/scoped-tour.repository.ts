import type { ApiAbility } from "../casl/api-ability";
import { accessibleByTourWhere, type TourAction } from "../casl/api-ability";
import { tourSubject } from "../casl/tour-subject";
import type { TourRecord, TourWhere } from "./tour-record";
import type { TourRepository, TourStorageRepository } from "./tour.repository";

function mergeWhere(ability: ApiAbility, action: TourAction, where?: Partial<TourWhere>): TourWhere {
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
    private readonly ability: ApiAbility,
  ) {}

  findMany(extra?: Partial<TourWhere>): Promise<readonly TourRecord[]> {
    return this.inner.findMany(mergeWhere(this.ability, "read", extra));
  }

  async findFirst(extra?: Partial<TourWhere>): Promise<TourRecord | null> {
    const scoped = accessibleByTourWhere(this.ability, "read");

    if (extra?.id !== undefined) {
      const hit = await this.inner.findFirst({ tenantId: scoped.tenantId, id: extra.id });
      if (hit) return hit;

      const existing = await this.inner.findById(extra.id);
      if (existing !== null && !this.ability.can("read", tourSubject({ tenantId: existing.tenantId }))) {
        throw new Error("FORBIDDEN_TOUR_READ_CROSS_TENANT");
      }
      return null;
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
}
