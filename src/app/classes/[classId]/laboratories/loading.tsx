import {
  LoadingPage,
  PageHeaderSkeleton,
  StatsGridSkeleton,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function LaboratoriesLoading() {
  return (
    <LoadingPage label="Loading laboratories">
      <PageHeaderSkeleton />
      <StatsGridSkeleton count={3} />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-6 w-56 max-w-full" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-4 w-72 max-w-full bg-gray-100" />
            <div className="mt-4 border-t border-gray-100 pt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </LoadingPage>
  );
}
