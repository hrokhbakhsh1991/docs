import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import { DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER } from "../storage/dual-store-role";
import {
  InMemoryWorkspaceDraftsRepository,
  resetWorkspaceDraftsRepositoryForTests,
  type WorkspaceDraftsRepository,
} from "./in-memory-workspace-drafts.repository";
import { PrismaWorkspaceDraftsRepository } from "./prisma-workspace-drafts.repository";

/** PSR-5h — InMemory branch retained as explicit test|dev adapter. */
export const DUAL_STORE_ROLE = DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER;

let singleton: WorkspaceDraftsRepository | null = null;
let singletonDriver: ReturnType<typeof resolveStorageDriver> | null = null;

export function getWorkspaceDraftsRepository(): WorkspaceDraftsRepository {
  assertProductionStorageDriver();

  // Test harness pins an in-memory repo while gate env exports STORAGE_DRIVER=prisma.
  if (singleton instanceof InMemoryWorkspaceDraftsRepository && singletonDriver === "memory") {
    return singleton;
  }

  const driver = resolveStorageDriver();
  if (singleton !== null && singletonDriver === driver) {
    return singleton;
  }

  if (driver === "prisma") {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
      throw new Error("STORAGE_DRIVER=prisma requires DATABASE_URL for workspace drafts repository");
    }
    singleton = new PrismaWorkspaceDraftsRepository();
  } else {
    singleton = new InMemoryWorkspaceDraftsRepository();
  }
  singletonDriver = driver;
  return singleton;
}

export function resetWorkspaceDraftsRepositorySingletonForTests(): InMemoryWorkspaceDraftsRepository {
  resetWorkspaceDraftsRepositoryForTests();
  const repo = new InMemoryWorkspaceDraftsRepository();
  singleton = repo;
  singletonDriver = "memory";
  return repo;
}

export function clearWorkspaceDraftsRepositorySingletonForTests(): void {
  singleton = null;
  singletonDriver = null;
}
