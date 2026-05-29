import { DataSource } from "typeorm";

import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";

export type SeedTourCatalogRow = {
  id: string;
  tenantId: string;
  title: string;
  totalCapacity?: number;
};

export async function seedTourCatalogRows(
  ds: DataSource,
  rows: SeedTourCatalogRow[],
): Promise<void> {
  const tourRepo = ds.getRepository(TourEntity);
  for (const row of rows) {
    await tourRepo.save(
      tourRepo.create({
        id: row.id,
        tenantId: row.tenantId,
        title: row.title,
        totalCapacity: row.totalCapacity ?? 10,
        acceptedCount: 0,
        lifecycleStatus: TourLifecycleStatus.DRAFT,
        transportModes: [],
      }),
    );
  }
}
