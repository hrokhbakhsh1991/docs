import { resolveStorageDriver } from "../storage/production-storage-driver-assert";
import { DATABASE_UNAVAILABLE } from "./database-connection-error";
import { getPrisma } from "./prisma";

export type DatabaseHealthCheck = {
  readonly status: "ok" | "fail";
  readonly code?: typeof DATABASE_UNAVAILABLE;
};

/** Returns null when prisma storage is not active (memory driver / tests). */
export async function probeDatabaseHealth(): Promise<DatabaseHealthCheck | null> {
  if (resolveStorageDriver() !== "prisma") {
    return null;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return { status: "fail", code: DATABASE_UNAVAILABLE };
  }

  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch {
    return { status: "fail", code: DATABASE_UNAVAILABLE };
  }
}
