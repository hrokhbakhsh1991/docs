import type { DataSource } from "typeorm";

import { WorkspaceDestinationEntity } from "../modules/settings-locations/entities/workspace-destination.entity";
import { WorkspaceRegionEntity } from "../modules/settings-locations/entities/workspace-region.entity";
import { emitScriptInfo } from "./script-log";

export async function ensureWorkspaceLocationCatalog(
  dataSource: DataSource,
  tenantId: string,
  labels?: { regionName?: string; destinationName?: string },
): Promise<{ regionId: string; destinationId: string }> {
  const destRepo = dataSource.getRepository(WorkspaceDestinationEntity);
  const existing = await destRepo.findOne({
    where: { tenantId, isActive: true },
    relations: { region: true },
  });
  if (existing) {
    return { regionId: existing.regionId, destinationId: existing.id };
  }

  const regionRepo = dataSource.getRepository(WorkspaceRegionEntity);
  const region = await regionRepo.save(
    regionRepo.create({
      tenantId,
      name: labels?.regionName ?? "QA — پیش‌فرض",
      country: "IR",
      sortOrder: 0,
      isActive: true,
    }),
  );
  const destination = await destRepo.save(
    destRepo.create({
      tenantId,
      regionId: region.id,
      name: labels?.destinationName ?? "مقصد پیش‌فرض QA",
      type: "شهر",
      sortOrder: 1,
      isActive: true,
    }),
  );
  emitScriptInfo("Inserted minimal region + destination for wizard location step.");
  return { regionId: region.id, destinationId: destination.id };
}
