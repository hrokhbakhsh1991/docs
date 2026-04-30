import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class SchedulerLockService {
  constructor(private readonly dataSource: DataSource) {}

  async runWithGlobalLock<T>(
    lockName: string,
    onLocked: () => Promise<T>
  ): Promise<{ acquired: boolean; result?: T }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const rows = (await queryRunner.query(
        "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
        [lockName]
      )) as Array<{ acquired: boolean }>;
      const acquired = rows[0]?.acquired === true;
      if (!acquired) {
        return { acquired: false };
      }
      try {
        const result = await onLocked();
        return { acquired: true, result };
      } finally {
        await queryRunner.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]);
      }
    } finally {
      await queryRunner.release();
    }
  }
}
