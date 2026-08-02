import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import { DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER } from "../storage/dual-store-role";
import {
  InMemoryWorkspaceDraftEventsRepository,
  resetWorkspaceDraftEventsRepositoryForTests,
  type WorkspaceDraftEventsRepository,
} from "./in-memory-workspace-draft-events.repository";
import { PrismaWorkspaceDraftEventsRepository } from "./prisma-workspace-draft-events.repository";

/** PSR-5h — InMemory branch retained as explicit test|dev adapter. */
export const DUAL_STORE_ROLE = DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER;

let singleton: WorkspaceDraftEventsRepository | null = null;
let singletonDriver: ReturnType<typeof resolveStorageDriver> | null = null;

export function getWorkspaceDraftEventsRepository(): WorkspaceDraftEventsRepository {
  assertProductionStorageDriver();

  // Test harness pins an in-memory repo while gate env exports STORAGE_DRIVER=prisma.
  if (
    singleton instanceof InMemoryWorkspaceDraftEventsRepository &&
    singletonDriver === "memory"
  ) {
    return singleton;
  }

  const driver = resolveStorageDriver();
  if (singleton !== null && singletonDriver === driver) {
    return singleton;
  }

  if (driver === "prisma") {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
      throw new Error(
        "STORAGE_DRIVER=prisma requires DATABASE_URL for workspace draft events repository"
      );
    }
    singleton = new PrismaWorkspaceDraftEventsRepository();
  } else {
    singleton = new InMemoryWorkspaceDraftEventsRepository();
  }
  singletonDriver = driver;
  return singleton;
}

export function resetWorkspaceDraftEventsRepositorySingletonForTests(): InMemoryWorkspaceDraftEventsRepository {
  resetWorkspaceDraftEventsRepositoryForTests();
  const repo = new InMemoryWorkspaceDraftEventsRepository();
  singleton = repo;
  singletonDriver = "memory";
  return repo;
}

export function clearWorkspaceDraftEventsRepositorySingletonForTests(): void {
  singleton = null;
  singletonDriver = null;
}
