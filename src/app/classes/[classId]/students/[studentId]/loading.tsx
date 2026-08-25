import {
  LoadingPage,
  StatsGridSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentProfileLoading() {
  return (
    <LoadingPage label="Loading student profile">
      <Skeleton className="h-5 w-32" />

      <div className="mt-5 flex items-start gap-4 border-b border-gray-200 pb-6 sm:items-center">
        <Skeleton className="h-13 w-13 shrink-0 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-3 w-24 bg-gray-100" />
          <Skeleton className="mt-1 h-7 w-64 max-w-full" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full bg-gray-100" />
        </div>
      </div>

      <StatsGridSkeleton />

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
        <div className="space-y-6">
          <TableSkeleton columns={3} rows={4} />
          <TableSkeleton columns={4} rows={4} />
          <TableSkeleton columns={3} rows={4} />
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 p-5 sm:px-6">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-2 h-4 w-52 max-w-full bg-gray-100" />
          </div>
          <div className="px-5 py-1 sm:px-6">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex gap-3 py-4">
                <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                <div className="flex-1 border-b border-gray-100 pb-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-2 h-3 w-4/5 bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingPage>
  );
}
