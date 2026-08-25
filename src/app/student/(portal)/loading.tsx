import { LoadingPage } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentPortalLoading() {
  return (
    <LoadingPage label="Loading student portal">
      <div className="rounded-2xl border border-blue-100 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-7 w-64 max-w-full" />
            <Skeleton className="mt-2 h-4 w-36" />
          </div>
        </div>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-9 w-20" />
            <Skeleton className="mt-3 h-3 w-44 max-w-full" />
          </div>
        ))}
      </div>
      <div className="mt-7 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        <div className="mt-6 space-y-5">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-52 max-w-full" />
                <Skeleton className="mt-2 h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingPage>
  );
}
