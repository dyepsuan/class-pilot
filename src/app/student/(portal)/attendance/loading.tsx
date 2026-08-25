import { LoadingPage } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentAttendanceLoading() {
  return (
    <LoadingPage label="Loading attendance records">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </div>
        <div className="sm:text-right">
          <Skeleton className="h-4 w-56 max-w-full sm:ml-auto" />
          <Skeleton className="mt-2 h-3 w-48 max-w-full sm:ml-auto" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-9 w-16" />
            <Skeleton className="mt-3 h-3 w-28 max-w-full" />
          </div>
        ))}
      </div>

      <div className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5 sm:px-6">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="grid gap-4 p-5 md:grid-cols-4 md:px-6"
            >
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </LoadingPage>
  );
}
