import { Injectable } from "@nestjs/common";

export type SchedulerJobSnapshot = {
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastDurationMs: number;
  lastErrorAt: string | null;
  startedTotal: number;
  finishedTotal: number;
  failedTotal: number;
  skippedDueLockTotal: number;
};

@Injectable()
export class SchedulerRuntimeMetricsService {
  private readonly jobs = new Map<string, SchedulerJobSnapshot>();

  noteStarted(job: string): void {
    const current = this.get(job);
    current.lastStartedAt = new Date().toISOString();
    current.startedTotal += 1;
    this.jobs.set(job, current);
  }

  noteFinished(job: string, durationMs: number): void {
    const current = this.get(job);
    current.lastFinishedAt = new Date().toISOString();
    current.lastDurationMs = Math.max(0, durationMs);
    current.finishedTotal += 1;
    this.jobs.set(job, current);
  }

  noteFailed(job: string): void {
    const current = this.get(job);
    current.lastErrorAt = new Date().toISOString();
    current.failedTotal += 1;
    this.jobs.set(job, current);
  }

  noteSkippedDueLock(job: string): void {
    const current = this.get(job);
    current.skippedDueLockTotal += 1;
    this.jobs.set(job, current);
  }

  getSnapshot(): Record<string, SchedulerJobSnapshot> {
    return Object.fromEntries(this.jobs.entries());
  }

  private get(job: string): SchedulerJobSnapshot {
    return (
      this.jobs.get(job) ?? {
        lastStartedAt: null,
        lastFinishedAt: null,
        lastDurationMs: 0,
        lastErrorAt: null,
        startedTotal: 0,
        finishedTotal: 0,
        failedTotal: 0,
        skippedDueLockTotal: 0
      }
    );
  }
}
