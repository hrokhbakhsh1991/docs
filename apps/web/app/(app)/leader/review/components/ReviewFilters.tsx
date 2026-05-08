"use client";

import type {
  QueueFilter,
  ReviewFiltersState,
  ReviewStatusFilter,
} from "@/features/leader-review/types";

import type { RegistrationStatus } from "@repo/types";
import { Button, FormField, Input, Select } from "@tour/ui";
import styles from "./ReviewFilters.module.css";

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
        <FormField label="Queue">
          <Select
            aria-label="Queue scope"
            value={value.queueFilter}
            onChange={(e) => onQueueFilterChange(e.target.value as QueueFilter)}
          >
            <option value="pending">Pending only</option>
            <option value="all">All statuses</option>
          </Select>
        </FormField>
      </div>

      <div className={styles.fieldCompact}>
        <FormField label="Status">
          <Select
            aria-label="Filter by status"
            value={value.statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as ReviewStatusFilter)}
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all" ? "All review statuses" : opt}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className={styles.fieldCompact}>
        <FormField label="Participant">
          <Input
            value={value.participantFilter}
            onChange={(e) => onParticipantFilterChange(e.target.value)}
            placeholder="Name / phone"
            aria-label="Filter by participant"
          />
        </FormField>
      </div>

      <div className={styles.fieldCompact}>
        <FormField label="From">
          <Input
            type="date"
            value={value.fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            aria-label="Updated from"
          />
        </FormField>
      </div>

      <div className={styles.fieldCompact}>
        <FormField label="To">
          <Input
            type="date"
            value={value.toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            aria-label="Updated to"
          />
        </FormField>
      </div>

      <div className={styles.actionsRow}>
        <div className={styles.actionsGroup}>
          <Button type="button" variant="secondary" disabled={!canExport} onClick={onExportCsv}>
            Export CSV
          </Button>
        </div>
        <div className={styles.actionsGroup}>
          <Button type="button" variant="secondary" disabled={isLoading} onClick={onRefresh}>
            Refresh data
          </Button>
        </div>
        <div className={styles.actionsGroup}>
          <Button type="button" variant="ghost" onClick={onClearFilters}>
            Clear filters
          </Button>
        </div>
      </div>
    </div>
  );
}

