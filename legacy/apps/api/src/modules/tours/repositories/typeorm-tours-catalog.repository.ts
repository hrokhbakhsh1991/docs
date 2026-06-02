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
  ToursCatalogListPageOutput,
  ToursCatalogRepositoryPort,
} from "../domain/ports/tours-repository.port";
import { TourEntity } from "../entities/tour.entity";
import type { TourWriteRecord, TourDestinationRegionRef } from "../domain/tour-write-record.types";
import type { TourDetailsPolicySnapshot } from "../domain/tour-policy.types";
import { TourDetails } from "../entities/tour-details.entity";
import { WorkspaceDestinationEntity } from "../../settings-locations/entities/workspace-destination.entity";
import { applyTourFilter, applyTourSort } from "./tours-query-builder";
import { applyRegionalTourListScope } from "../utils/apply-regional-tour-list-scope";

const mapTourDestinationToRef = (destination?: WorkspaceDestinationEntity | null): TourDestinationRegionRef | null => {
  if (!destination) return null;
  return {
    id: destination.id,
    name: destination.name,
    regionId: destination.regionId,
    region: destination.region
      ? {
          id: destination.region.id,
          name: destination.region.name,
        }
      : null,
  };
};

const mapTourDetailsToPolicySnapshot = (details?: TourDetails | null): TourDetailsPolicySnapshot | null => {
  if (!details) return null;
  return {
    destinationName: details.destinationName,
    elevationM: details.elevationM,
    difficulty: details.difficulty,
    durationDays: details.durationDays,
    meetingPoint: details.meetingPoint,
    itinerary: details.itinerary,
    tripDetails: details.tripDetails,
  };
};

const asTourWriteRecord = (row: TourEntity | null): TourWriteRecord | null => {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    title: row.title,
    description: row.description,
    totalCapacity: row.totalCapacity,
    acceptedCount: row.acceptedCount,
    lifecycleStatus: row.lifecycleStatus,
    chatLink: row.chatLink,
    costContext: row.costContext,
    autoAcceptRegistrations: row.autoAcceptRegistrations,
    tourType: row.tourType,
    transportModes: row.transportModes,
    destination: mapTourDestinationToRef(row.destination),
    details: mapTourDetailsToPolicySnapshot(row.details),
    tourProductId: row.tourProductId,
    tourDepartureId: row.tourDepartureId,
    createdByUserId: row.createdByUserId,
    formProfileSnapshot: row.formProfileSnapshot,
    metadata: row.metadata ?? null,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    currencyCode: row.currencyCode,
    listPriceMinor: row.listPriceMinor,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

@Injectable()
export class TypeOrmToursCatalogRepository implements ToursCatalogRepositoryPort {
  constructor(
    @InjectRepository(TourEntity)
    private readonly tourRepository: Repository<TourEntity>,
  ) {}

  async listTours(input: ToursCatalogListPageInput): Promise<ToursCatalogListPageOutput> {
    const { tenantId, filter, sort, includeTotal, regionalScope, page, limit, useKeyset, cursorAt, cursorId } = input;

    const qb = this.tourRepository
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.details", "details")
      .leftJoinAndSelect("t.destination", "destination")
      .leftJoinAndSelect("destination.region", "destinationRegion")
      .where("t.tenantId = :tenantId", { tenantId });

    applyTourFilter(qb, filter);
    applyTourSort(qb, sort);
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

    const total = includeTotal !== false ? await qb.getCount() : -1;

    const dataQb = qb.clone();
    if (!useKeyset) {
      dataQb.skip((page - 1) * limit);
    }
    const rows = await dataQb.take(limit).getMany();

    return {
      items: rows.map((row) => asTourWriteRecord(row)!),
      total,
      page,
      limit,
    };
  }

  async findById(tourId: string, tenantId: string): Promise<TourWriteRecord | null> {
    const tour = await this.tourRepository.findOne({
      where: {
        id: tourId,
        tenantId,
      },
      relations: TOUR_RESPONSE_RELATIONS,
    });

    return asTourWriteRecord(tour);
  }

  async findByIdOrThrow(tourId: string, tenantId: string): Promise<TourWriteRecord> {
    const tour = await this.findById(tourId, tenantId);

    if (!tour) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    return tour;
  }
}
