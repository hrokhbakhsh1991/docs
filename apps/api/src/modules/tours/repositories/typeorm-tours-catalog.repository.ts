/**
 * TypeORM adapter for {@link ToursCatalogRepositoryPort}.
 * This is the only tours-module file allowed to import `@nestjs/typeorm` / `typeorm` for catalog reads.
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";

import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import { TOUR_RESPONSE_RELATIONS } from "../constants/tour-response-relations";
import type {
  ToursCatalogListPageInput,
  ToursCatalogListPageResult,
  ToursCatalogRepositoryPort,
} from "../domain/ports/tours-repository.port";
import { toTourFilter, toTourSort } from "../dto/list-tours-query.dto";
import { mapTourEntityToResponseDto } from "../dto/tour-response.dto";
import { TourEntity } from "../entities/tour.entity";
import type { TourWriteRecord } from "../domain/tour-write-record.types";
import { applyTourFilter, applyTourSort } from "./tours-query-builder";
import { applyRegionalTourListScope } from "../utils/apply-regional-tour-list-scope";

@Injectable()
export class TypeOrmToursCatalogRepository implements ToursCatalogRepositoryPort {
  constructor(
    @InjectRepository(TourEntity)
    private readonly tourRepository: Repository<TourEntity>,
  ) {}

  async listPage(input: ToursCatalogListPageInput): Promise<ToursCatalogListPageResult> {
    const { tenantId, query, regionalScope, page, limit, useKeyset, cursorAt, cursorId } = input;

    const qb = this.tourRepository
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.details", "details")
      .leftJoinAndSelect("t.destination", "destination")
      .leftJoinAndSelect("destination.region", "destinationRegion")
      .where("t.tenantId = :tenantId", { tenantId });

    applyTourFilter(qb, toTourFilter(query));
    applyTourSort(qb, toTourSort(query));
    applyRegionalTourListScope(qb, regionalScope);

    if (useKeyset && cursorAt !== null && cursorId !== null) {
      qb.andWhere(
        new Brackets((b) => {
          b.where("t.createdAt < :cAt", { cAt: cursorAt }).orWhere(
            new Brackets((inner) => {
              inner
                .where("t.createdAt = :cAt", { cAt: cursorAt })
                .andWhere("t.id < :cId", { cId: cursorId });
            }),
          );
        }),
      );
    }

    const includeTotal = query.include_total !== false;
    const total = includeTotal ? await qb.getCount() : -1;

    const dataQb = qb.clone();
    if (!useKeyset) {
      dataQb.skip((page - 1) * limit);
    }
    const rows = await dataQb.take(limit).getMany();

    return {
      items: rows.map((row) => mapTourEntityToResponseDto(row)),
      total,
      page,
      limit,
    };
  }

  async findByIdOrThrow(tenantId: string, tourId: string): Promise<TourWriteRecord> {
    const tour = await this.tourRepository.findOne({
      where: {
        id: tourId,
        tenantId,
      },
      relations: TOUR_RESPONSE_RELATIONS,
    });

    if (!tour) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    return tour as TourWriteRecord;
  }
}
