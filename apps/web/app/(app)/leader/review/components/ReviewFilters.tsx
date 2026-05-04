"use client";

import type {
  QueueFilter,
  ReviewFiltersState,
  ReviewStatusFilter,
} from "@/features/leader-review/types";

import type { RegistrationStatus } from "@repo/types";
import { Button, Input, Select } from "@tour/ui";

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
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
      <Select
        aria-label="Queue scope"
        value={value.queueFilter}
        onChange={(e) => onQueueFilterChange(e.target.value as QueueFilter)}
      >
        <option value="pending">Pending only</option>
        <option value="all">All statuses</option>
      </Select>
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
      <Input
        value={value.participantFilter}
        onChange={(e) => onParticipantFilterChange(e.target.value)}
        placeholder="Filter participant / phone"
        aria-label="Filter by participant"
      />
      <Input
        type="date"
        value={value.fromDate}
        onChange={(e) => onFromDateChange(e.target.value)}
        aria-label="Updated from"
      />
      <Input
        type="date"
        value={value.toDate}
        onChange={(e) => onToDateChange(e.target.value)}
        aria-label="Updated to"
      />
      <Button type="button" variant="secondary" disabled={!canExport} onClick={onExportCsv}>
        Export CSV
      </Button>
      <Button type="button" variant="secondary" disabled={isLoading} onClick={onRefresh}>
        Refresh data
      </Button>
      <Button type="button" variant="ghost" onClick={onClearFilters}>
        Clear filters
      </Button>
    </div>
  );
}

