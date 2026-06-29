import { withTenantRls } from "../db/with-tenant-rls";

export type DenaliReminderActivationRecord = {
  readonly activationId: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly reminderOffset: string;
  readonly anchorAt: string;
  readonly activatedAt: string;
};

function toRecord(row: {
  id: string;
  tenantId: string;
  tourId: string;
  reminderOffset: string;
  anchorAt: Date;
  activatedAt: Date;
}): DenaliReminderActivationRecord {
  return Object.freeze({
    activationId: row.id,
    tenantId: row.tenantId,
    tourId: row.tourId,
    reminderOffset: row.reminderOffset,
    anchorAt: row.anchorAt.toISOString(),
    activatedAt: row.activatedAt.toISOString(),
  });
}

export async function listDenaliReminderActivations(input: {
  readonly tenantId: string;
  readonly limit?: number;
}): Promise<readonly DenaliReminderActivationRecord[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  return withTenantRls(input.tenantId, async (tx) => {
    const rows = await tx.denaliExposureReminderActivation.findMany({
      where: { tenantId: input.tenantId },
      orderBy: { activatedAt: "desc" },
      take: limit,
    });
    return Object.freeze(rows.map(toRecord));
  });
}

export async function upsertDenaliReminderActivation(input: {
  readonly tenantId: string;
  readonly tourId: string;
  readonly reminderOffset: string;
  readonly anchorAt: Date;
}): Promise<boolean> {
  return withTenantRls(input.tenantId, async (tx) => {
    try {
      await tx.denaliExposureReminderActivation.create({
        data: {
          tenantId: input.tenantId,
          tourId: input.tourId,
          reminderOffset: input.reminderOffset,
          anchorAt: input.anchorAt,
        },
      });
      return true;
    } catch (error: unknown) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string"
          ? (error as { code: string }).code
          : "";
      if (code === "P2002") {
        return false;
      }
      throw error;
    }
  });
}

export function buildDenaliReminderFeedPort() {
  return {
    async listDueActivations(input: { readonly tenantId: string; readonly limit?: number }) {
      return listDenaliReminderActivations(input);
    },
  };
}
