import {
  LoadingPage,
  SectionSkeleton,
  StatsGridSkeleton,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClassOverviewLoading() {
  return (
    <LoadingPage label="Loading class overview">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-3 h-4 w-64 max-w-full bg-gray-100" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg sm:w-32" />
          ))}
        </div>
      </div>
      <StatsGridSkeleton />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="grid min-w-0 gap-6">
          <SectionSkeleton rows={4} />
          <SectionSkeleton rows={5} />
        </div>
        <SectionSkeleton rows={6} />
      </div>
    </LoadingPage>
  );
}
