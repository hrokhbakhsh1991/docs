import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { ConfigService } from "../config/config.service";
import { TourWizardDraftEntity } from "../modules/tours/entities/tour-wizard-draft.entity";
import { SchedulerLockService } from "./scheduler-lock.service";
import { SchedulerRuntimeMetricsService } from "./scheduler-runtime-metrics.service";

/** Daily interval aligned with maplog EVERY_DAY_AT_3AM (first run scheduled to 03:00 UTC). */
const TOUR_WIZARD_DRAFT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Hard-delete drafts not touched in 30 days. */
export const TOUR_WIZARD_DRAFT_RETENTION_DAYS = 30;

/** Next 03:00:00.000 UTC from `from` (same calendar day if still before 03:00, else tomorrow). */
export function msUntilNext0300Utc(from: Date = new Date()): number {
  const next = new Date(from);
  next.setUTCHours(3, 0, 0, 0);
  if (next.getTime() <= from.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - from.getTime();
}

@Injectable()
export class TourWizardDraftCleanupJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TourWizardDraftCleanupJob.name);
  private interval?: NodeJS.Timeout;
  private initialTimeout?: NodeJS.Timeout;
  private readonly jobName = "tour_wizard_draft_cleanup";
  private readonly lockName = "scheduler:tour_wizard_draft_cleanup";

  constructor(
    @InjectRepository(TourWizardDraftEntity)
    private readonly draftRepository: Repository<TourWizardDraftEntity>,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SchedulerLockService) private readonly schedulerLock: SchedulerLockService,
    @Inject(SchedulerRuntimeMetricsService)
    private readonly schedulerMetrics: SchedulerRuntimeMetricsService,
  ) {}

  onModuleInit(): void {
    if (!this.configService.shouldRunSchedulers()) {
      this.logger.log("job_skipped_runtime_role tour_wizard_draft_cleanup");
      return;
    }
    const jitterMs = Math.floor(Math.random() * (this.configService.getSchedulerJitterMs() + 1));
    const delayMs = msUntilNext0300Utc() + jitterMs;
    this.initialTimeout = setTimeout(() => {
      void this.runOnceWithLock();
      this.interval = setInterval(() => {
        void this.runOnceWithLock();
      }, TOUR_WIZARD_DRAFT_CLEANUP_INTERVAL_MS);
      this.interval.unref?.();
    }, delayMs);
    this.initialTimeout.unref?.();
  }

  onModuleDestroy(): void {
    if (this.initialTimeout) {
      clearTimeout(this.initialTimeout);
    }
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async deleteStaleDrafts(): Promise<number> {
    const result = await this.draftRepository
      .createQueryBuilder()
      .delete()
      .from(TourWizardDraftEntity)
      .where(`updated_at < NOW() - INTERVAL '${TOUR_WIZARD_DRAFT_RETENTION_DAYS} days'`)
      .execute();
    return result.affected ?? 0;
  }

  private async runOnceWithLock(): Promise<void> {
    const started = Date.now();
    this.schedulerMetrics.noteStarted(this.jobName);
    this.logger.log("job_started tour_wizard_draft_cleanup");
    try {
      const lock = await this.schedulerLock.runWithGlobalLock(this.lockName, async () => {
        const deleted = await this.deleteStaleDrafts();
        this.logger.log(
          `TourWizardDraftCleanupJob: deleted ${deleted} tour_wizard_drafts older than ${TOUR_WIZARD_DRAFT_RETENTION_DAYS} days`,
        );
      });
      if (!lock.acquired) {
        this.schedulerMetrics.noteSkippedDueLock(this.jobName);
        this.logger.log("job_skipped_due_lock tour_wizard_draft_cleanup");
        return;
      }
      this.schedulerMetrics.noteFinished(this.jobName, Date.now() - started);
      this.logger.log("job_finished tour_wizard_draft_cleanup");
    } catch (error: unknown) {
      this.schedulerMetrics.noteFailed(this.jobName);
      this.logger.warn(`tour wizard draft cleanup failed: ${String(error)}`);
    }
  }
}
