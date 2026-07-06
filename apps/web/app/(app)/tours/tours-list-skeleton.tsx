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
      <DenaliSkeleton size="search" />

      <div className="flex flex-wrap gap-2">
        <DenaliSkeleton size="chip-xs" />
        <DenaliSkeleton size="chip-md" />
        <DenaliSkeleton size="chip-sm" />
        <DenaliSkeleton size="chip-md" />
      </div>

      {hasCategoryFilter ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <DenaliSkeleton size="label-lg" />
            <DenaliSkeleton size="chip-sm" />
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <DenaliSkeleton size="label-md" />
              <div className="flex flex-wrap gap-1">
                <DenaliSkeleton size="chip-lg" />
                <DenaliSkeleton size="chip-xl" />
                <DenaliSkeleton size="chip-md" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <DenaliSkeleton size="label-sm" />
        <DenaliSkeleton size="chip-lg" />
        <DenaliSkeleton size="chip-xl" />
        <DenaliSkeleton size="chip-md" />
        <DenaliSkeleton size="chip-xl" />
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
      <DenaliSkeleton size="hero" />
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <DenaliSkeleton size="badge-sm" />
          <DenaliSkeleton size="badge-lg" />
          <DenaliSkeleton size="badge-md" />
        </div>
        <DenaliSkeleton size="title" />
        <DenaliSkeleton size="subtitle" />
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        <DenaliSkeleton size="line-full" />
        <DenaliSkeleton size="line-full" />
        <DenaliSkeleton size="line-partial" />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <DenaliSkeleton size="chip-md" />
        <DenaliSkeleton size="chip-lg" />
        <DenaliSkeleton size="chip-sm" />
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
