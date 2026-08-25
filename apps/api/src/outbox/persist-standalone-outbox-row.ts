import type { EnqueueOutboxEventInput } from "./enqueue-domain-event";
import { enqueueOutboxEvent } from "./enqueue-domain-event";

function isPrismaStorageDriverActive(): boolean {
  return process.env.STORAGE_DRIVER === "prisma" && Boolean(process.env.DATABASE_URL?.trim());
}

/** Persist one outbox row outside an aggregate TX (memory driver uses tour-local buffers). */
export async function persistStandaloneOutboxRowIfPrismaDriver(
  input: EnqueueOutboxEventInput
): Promise<boolean> {
  if (!isPrismaStorageDriverActive()) {
    return false;
  }
  const { getPrisma } = await import("../db/prisma");
  const prisma = getPrisma();
  await enqueueOutboxEvent(prisma, input);
  return true;
}
