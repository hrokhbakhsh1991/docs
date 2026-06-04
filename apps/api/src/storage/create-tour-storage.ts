import type { Tour, TourIdResolver, TourStorageRepository } from "./tour-storage.interface";
import { InMemoryTourRepository } from "./in-memory-tour.repository";
import { PrismaTourRepository } from "./prisma-tour.repository";

export type TourStorageDriver = "memory" | "prisma";

export type TourStorageImplementation = TourStorageRepository &
  TourIdResolver & {
    createTour(data: { tenantId: string; canonical: Tour["canonical"] }): Promise<Tour>;
  };

function resolveStorageDriver(): TourStorageDriver {
  const explicit = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (explicit === "memory" || explicit === "prisma") {
    return explicit;
  }
  return process.env.NODE_ENV === "production" ? "prisma" : "memory";
}

/**
 * DI factory — `STORAGE_DRIVER=memory|prisma` or NODE_ENV default (test→memory, production→prisma).
 */
export function createTourStorageRepository(): TourStorageImplementation {
  const driver = resolveStorageDriver();
  if (driver === "prisma") {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
      throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL");
    }
    return new PrismaTourRepository();
  }
  return new InMemoryTourRepository();
}
