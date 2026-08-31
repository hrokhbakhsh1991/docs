import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { TOURS_LIST_TEST_IDS } from "@/features/tours/query-model";

/** Mirrors compact search + filters trigger + sort toolbar layout. */
export function ToursListToolbarSkeleton() {
  return (
    <div className="space-y-3" data-testid={TOURS_LIST_TEST_IDS.toolbarSkeleton}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="max-w-xl flex-1">
          <OperatorSkeleton size="search" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OperatorSkeleton size="chip-md" />
          <OperatorSkeleton size="chip-lg" />
        </div>
      </div>
    </div>
  );
}

function ToursDirectoryRowSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border bg-card/40 p-4 lg:flex-row lg:items-center"
      data-testid={TOURS_LIST_TEST_IDS.rowSkeleton}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <OperatorSkeleton size="title" />
        <OperatorSkeleton size="subtitle" />
      </div>
      <div className="flex flex-wrap gap-2">
        <OperatorSkeleton size="badge-sm" />
        <OperatorSkeleton size="badge-md" />
      </div>
      <div className="flex gap-2">
        <OperatorSkeleton size="chip-md" />
        <OperatorSkeleton size="chip-lg" />
      </div>
    </div>
  );
}

type ToursListSkeletonProps = {
  readonly count?: number;
};

export function ToursListSkeleton({ count = 6 }: ToursListSkeletonProps) {
  return (
    <div
      className="space-y-3"
      data-testid={TOURS_LIST_TEST_IDS.listSkeleton}
      aria-busy="true"
      aria-label="Loading tours"
    >
      {Array.from({ length: count }).map((_, index) => (
        <ToursDirectoryRowSkeleton key={index} />
      ))}
    </div>
  );
}
