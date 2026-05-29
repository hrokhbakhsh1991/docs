import type { SelectQueryBuilder } from "typeorm";
import type { TourFilter, TourSort } from "@repo/shared-contracts";
import { TourLifecycleStatus } from "@repo/domain-contracts";

import type { TourEntity } from "../entities/tour.entity";

const DIFFICULTY_ORDER_SQL =
  "CASE WHEN details.difficulty = 'easy' THEN 1 WHEN details.difficulty = 'moderate' THEN 2 WHEN details.difficulty = 'hard' THEN 3 WHEN details.difficulty = 'technical' THEN 4 ELSE 99 END";

const CATEGORY_ORDER_SQL =
  "CASE WHEN t.tourType = 'nature' THEN 1 WHEN t.tourType = 'city' THEN 2 WHEN t.tourType = 'desert' THEN 3 WHEN t.tourType = 'mountain' THEN 4 WHEN t.tourType = 'cultural' THEN 5 ELSE 99 END";

export function applyTourFilter(
  qb: SelectQueryBuilder<TourEntity>,
  filter: TourFilter,
): SelectQueryBuilder<TourEntity> {
  const search = filter.search?.trim() ?? "";
  if (search.length > 0) {
    qb.andWhere("t.search_vector @@ plainto_tsquery('simple', :fts)", {
      fts: search,
    });
  }

  if (filter.status === "active") {
    qb.andWhere("t.lifecycleStatus = :lifecycleStatus", {
      lifecycleStatus: TourLifecycleStatus.DRAFT,
    });
  } else if (filter.status === "completed") {
    qb.andWhere("t.lifecycleStatus = :lifecycleStatus", {
      lifecycleStatus: TourLifecycleStatus.OPEN,
    });
  } else if (filter.status === "archived") {
    qb.andWhere("t.lifecycleStatus IN (:...archivedStatuses)", {
      archivedStatuses: [TourLifecycleStatus.CLOSED, TourLifecycleStatus.CANCELLED],
    });
  }

  if (Array.isArray(filter.category) && filter.category.length > 0) {
    qb.andWhere("t.tourType IN (:...categoryFilter)", {
      categoryFilter: filter.category,
    });
  }

  if (Array.isArray(filter.difficulty) && filter.difficulty.length > 0) {
    qb.andWhere("details.difficulty IN (:...difficultyFilter)", {
      difficultyFilter: filter.difficulty,
    });
  }

  return qb;
}

export function applyTourSort(
  qb: SelectQueryBuilder<TourEntity>,
  sort?: TourSort | null,
): SelectQueryBuilder<TourEntity> {
  const dir = sort?.dir === "asc" ? "ASC" : "DESC";
  const stableDir = dir;

  if (!sort || sort.field === "created_at") {
    qb.orderBy("t.createdAt", dir).addOrderBy("t.id", stableDir);
    return qb;
  }

  if (sort.field === "title") {
    qb.orderBy("LOWER(t.title)", dir);
  } else if (sort.field === "price") {
    qb.orderBy("COALESCE(t.listPriceMinor::bigint, 0)", dir);
  } else if (sort.field === "difficulty") {
    qb.addSelect(DIFFICULTY_ORDER_SQL, "sort_difficulty");
    qb.orderBy("sort_difficulty", dir);
  } else if (sort.field === "category") {
    qb.addSelect(CATEGORY_ORDER_SQL, "sort_category");
    qb.orderBy("sort_category", dir);
  }

  qb.addOrderBy("t.createdAt", "DESC").addOrderBy("t.id", "DESC");
  return qb;
}
