import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { TOURS_LIST_TEST_IDS } from "@/features/tours/query-model";

type ToursListToolbarSkeletonProps = {
  readonly hasCategoryFilter?: boolean;
};

/** Mirrors search + status + optional category groups + sort toolbar layout. */
export function ToursListToolbarSkeleton({ hasCategoryFilter = false }: ToursListToolbarSkeletonProps) {
  return (
    <div className="space-y-4" data-testid={TOURS_LIST_TEST_IDS.toolbarSkeleton}>
      <DenaliSkeleton className="h-10 w-full max-w-xl rounded-md" />

      <div className="flex flex-wrap gap-2">
        <DenaliSkeleton className="h-9 w-14 rounded-md" />
        <DenaliSkeleton className="h-9 w-20 rounded-md" />
        <DenaliSkeleton className="h-9 w-16 rounded-md" />
        <DenaliSkeleton className="h-9 w-20 rounded-md" />
      </div>

      {hasCategoryFilter ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <DenaliSkeleton className="h-4 w-24 rounded-md" />
            <DenaliSkeleton className="h-9 w-16 rounded-md" />
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <DenaliSkeleton className="h-4 w-20 rounded-md" />
              <div className="flex flex-wrap gap-1">
                <DenaliSkeleton className="h-9 w-24 rounded-md" />
                <DenaliSkeleton className="h-9 w-28 rounded-md" />
                <DenaliSkeleton className="h-9 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <DenaliSkeleton className="h-4 w-16 rounded-md" />
        <DenaliSkeleton className="h-9 w-24 rounded-md" />
        <DenaliSkeleton className="h-9 w-28 rounded-md" />
        <DenaliSkeleton className="h-9 w-20 rounded-md" />
        <DenaliSkeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}

/** Mirrors `TourCard` — 16:9 cover, badges, title, meta, description, footer actions. */
export function TourCardSkeleton() {
  return (
    <Card
      data-denali-surface="card"
      className="flex h-full flex-col overflow-hidden shadow-sm"
      data-testid={TOURS_LIST_TEST_IDS.cardSkeleton}
    >
      <DenaliSkeleton className="aspect-[16/9] w-full rounded-none" />
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <DenaliSkeleton className="h-5 w-14 rounded-full" />
          <DenaliSkeleton className="h-5 w-20 rounded-full" />
          <DenaliSkeleton className="h-5 w-16 rounded-full" />
        </div>
        <DenaliSkeleton className="h-6 w-4/5 max-w-full rounded-md" />
        <DenaliSkeleton className="h-4 w-3/5 max-w-full rounded-md" />
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        <DenaliSkeleton className="h-3 w-full rounded-md" />
        <DenaliSkeleton className="h-3 w-full rounded-md" />
        <DenaliSkeleton className="h-3 w-2/3 rounded-md" />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <DenaliSkeleton className="h-9 w-20 rounded-md" />
        <DenaliSkeleton className="h-9 w-24 rounded-md" />
        <DenaliSkeleton className="h-9 w-16 rounded-md" />
      </CardFooter>
    </Card>
  );
}

type ToursListSkeletonProps = {
  readonly count?: number;
};

export function ToursListSkeleton({ count = 6 }: ToursListSkeletonProps) {
  return (
    <ul
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid={TOURS_LIST_TEST_IDS.listSkeleton}
      aria-busy="true"
      aria-label="Loading tours"
    >
      {Array.from({ length: count }).map((_, index) => (
        <li key={index}>
          <TourCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
