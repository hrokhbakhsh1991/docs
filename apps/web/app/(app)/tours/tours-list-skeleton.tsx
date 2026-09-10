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

function ToursListTableRowSkeleton() {
  return (
    <tr className="border-b last:border-b-0" data-testid={TOURS_LIST_TEST_IDS.rowSkeleton}>
      <td className="px-4 py-3">
        <div className="space-y-2">
          <OperatorSkeleton size="title" />
          <OperatorSkeleton size="subtitle" />
        </div>
      </td>
      <td className="px-4 py-3"><OperatorSkeleton size="badge-sm" /></td>
      <td className="px-4 py-3"><OperatorSkeleton size="chip-md" /></td>
      <td className="px-4 py-3"><OperatorSkeleton size="chip-md" /></td>
      <td className="px-4 py-3"><OperatorSkeleton size="chip-md" /></td>
      <td className="px-4 py-3"><OperatorSkeleton size="chip-md" /></td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <OperatorSkeleton size="chip-md" />
          <OperatorSkeleton size="chip-md" />
        </div>
      </td>
    </tr>
  );
}

function ToursListMobileRowSkeleton() {
  return (
    <li
      className="rounded-xl border bg-card/40 p-4"
      data-testid={TOURS_LIST_TEST_IDS.mobileRowSkeleton}
    >
      <div className="space-y-3">
        <OperatorSkeleton size="title" />
        <div className="flex gap-2">
          <OperatorSkeleton size="badge-sm" />
          <OperatorSkeleton size="badge-md" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <OperatorSkeleton size="chip-md" />
          <OperatorSkeleton size="chip-md" />
          <OperatorSkeleton size="chip-md" />
          <OperatorSkeleton size="chip-md" />
        </div>
        <div className="flex gap-2">
          <OperatorSkeleton size="chip-md" />
          <OperatorSkeleton size="chip-md" />
        </div>
      </div>
    </li>
  );
}

type ToursListSkeletonProps = {
  readonly count?: number;
};

/** Mirrors operator directory table (desktop) + compact rows (mobile). */
export function ToursListSkeleton({ count = 8 }: ToursListSkeletonProps) {
  return (
    <div data-testid={TOURS_LIST_TEST_IDS.listSkeleton} aria-busy="true" aria-label="Loading tours">
      <div className="hidden overflow-hidden rounded-xl border lg:block">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {Array.from({ length: Math.min(count, 8) }).map((_, index) => (
              <ToursListTableRowSkeleton key={`table-${index}`} />
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid grid-cols-1 gap-3 lg:hidden">
        {Array.from({ length: Math.min(count, 6) }).map((_, index) => (
          <ToursListMobileRowSkeleton key={`mobile-${index}`} />
        ))}
      </ul>
    </div>
  );
}
