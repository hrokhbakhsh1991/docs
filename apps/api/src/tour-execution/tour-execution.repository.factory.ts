import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import {
  InMemoryTourExecutionRepository,
  resetInMemoryTourExecutionRepositoryForTests,
  type TourExecutionRepository,
} from "./tour-execution.repository";
import { PrismaTourExecutionRepository } from "./prisma-tour-execution.repository";

let singleton: TourExecutionRepository | null = null;
let singletonDriver: ReturnType<typeof resolveStorageDriver> | null = null;

export function getTourExecutionRepository(): TourExecutionRepository {
  assertProductionStorageDriver();
  const driver = resolveStorageDriver();
  if (singleton !== null && singletonDriver === driver) {
    return singleton;
  }
  if (driver === "prisma") {
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL for tour execution repository");
    }
    singleton = new PrismaTourExecutionRepository();
  } else {
    singleton = new InMemoryTourExecutionRepository();
  }
  singletonDriver = driver;
  return singleton;
}

export function resetTourExecutionRepositoryForTests(): void {
  resetInMemoryTourExecutionRepositoryForTests();
  singleton = new InMemoryTourExecutionRepository();
  singletonDriver = "memory";
}

export function clearTourExecutionRepositoryForTests(): void {
  singleton = null;
  singletonDriver = null;
}
