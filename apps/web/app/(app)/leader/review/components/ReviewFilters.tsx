"use client";

import type {
  QueueFilter,
  ReviewFiltersState,
  ReviewStatusFilter,
} from "@/features/leader-review/types";

import type { RegistrationStatus } from "@repo/types";
import { Button, FormField, Input, Select } from "@tour/ui";

import { formatRegistrationStatusFa } from "@/lib/registrations/format-registration-status-fa";

import { LEADER_REVIEW_COPY } from "../leader-review-copy";
import styles from "./ReviewFilters.module.css";

const copy = LEADER_REVIEW_COPY.filters;

const STATUS_FILTER_OPTIONS: readonly (ReviewStatusFilter | RegistrationStatus)[] = [
  "all",
  "Pending",
  "Accepted",
  "AcceptedPaid",
  "Rejected",
  "Cancelled",
  "Refunded",
  "NoShow",
];

function statusFilterLabel(opt: ReviewStatusFilter | RegistrationStatus): string {
  if (opt === "all") return copy.statusAll;
  return formatRegistrationStatusFa(opt);
}

export type ReviewFiltersProps = {
  value: ReviewFiltersState;
  isLoading: boolean;
  canExport: boolean;
  onQueueFilterChange: (next: QueueFilter) => void;
  onStatusFilterChange: (next: ReviewStatusFilter) => void;
  onParticipantFilterChange: (next: string) => void;
  onFromDateChange: (next: string) => void;
  onToDateChange: (next: string) => void;
  onExportCsv: () => void;
  onRefresh: () => void;
  onClearFilters: () => void;
};

export function ReviewFilters({
  value,
  isLoading,
  canExport,
  onQueueFilterChange,
  onStatusFilterChange,
  onParticipantFilterChange,
  onFromDateChange,
  onToDateChange,
  onExportCsv,
  onRefresh,
  onClearFilters,
}: ReviewFiltersProps) {
  return (
    <div className={styles.filtersBar}>
      <div className={styles.fieldCompact}>
        <FormField label={copy.queueLabel}>
          <Select
            aria-label={copy.queueLabel}
            value={value.queueFilter}
            onChange={(e) => onQueueFilterChange(e.target.value as QueueFilter)}
          >
            <option value="pending">{copy.queuePending}</option>
            <option value="all">{copy.queueAll}</option>
          </Select>
        </FormField>
      </div>

      <div className={styles.fieldCompact}>
        <FormField label={copy.statusLabel}>
          <Select
            aria-label={copy.statusLabel}
            value={value.statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as ReviewStatusFilter)}
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {statusFilterLabel(opt)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className={styles.fieldCompact}>
        <FormField label={copy.participantLabel}>
          <Input
            value={value.participantFilter}
            onChange={(e) => onParticipantFilterChange(e.target.value)}
            placeholder={copy.participantPlaceholder}
            aria-label={copy.participantLabel}
          />
        </FormField>
      </div>

      <div className={styles.fieldCompact}>
        <FormField label={copy.fromLabel}>
          <Input
            type="date"
            value={value.fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            aria-label={copy.fromLabel}
          />
        </FormField>
      </div>

      <div className={styles.fieldCompact}>
        <FormField label={copy.toLabel}>
          <Input
            type="date"
            value={value.toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            aria-label={copy.toLabel}
          />
        </FormField>
      </div>

      <div className={styles.actionsRow}>
        <div className={styles.actionsGroup}>
          <Button type="button" variant="secondary" disabled={!canExport} onClick={onExportCsv}>
            {copy.exportCsv}
          </Button>
        </div>
        <div className={styles.actionsGroup}>
          <Button type="button" variant="secondary" disabled={isLoading} onClick={onRefresh}>
            {copy.refresh}
          </Button>
        </div>
        <div className={styles.actionsGroup}>
          <Button type="button" variant="ghost" onClick={onClearFilters}>
            {copy.clearFilters}
          </Button>
        </div>
      </div>
    </div>
  );
}
