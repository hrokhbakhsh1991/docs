import { getPrismaAdmin } from "../db/prisma.ts";

export type PlatformOpsUserRow = {
  readonly phone: string;
  readonly role: string;
  readonly createdAt: Date;
};

export class PlatformOpsUserRepository {
  async findByPhone(phone: string): Promise<PlatformOpsUserRow | null> {
    const row = await getPrismaAdmin().platformOpsUser.findUnique({
      where: { phone },
      select: { phone: true, role: true, createdAt: true },
    });
    return row;
  }

  async listAll(): Promise<PlatformOpsUserRow[]> {
    return getPrismaAdmin().platformOpsUser.findMany({
      orderBy: { createdAt: "asc" },
      select: { phone: true, role: true, createdAt: true },
    });
  }

  async upsert(input: { phone: string; role: string }): Promise<PlatformOpsUserRow> {
    const row = await getPrismaAdmin().platformOpsUser.upsert({
      where: { phone: input.phone },
      create: { phone: input.phone, role: input.role },
      update: { role: input.role },
      select: { phone: true, role: true, createdAt: true },
    });
    return row;
  }
}
