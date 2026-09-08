import { LoadingPage } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentDropboxLoading() {
  return (
    <LoadingPage label="Loading Dropbox" className="w-full">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-8 w-36" />
          <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        </div>
        <div className="sm:text-right">
          <Skeleton className="h-4 w-56 max-w-full sm:ml-auto" />
          <Skeleton className="mt-2 h-4 w-48 max-w-full sm:ml-auto" />
        </div>
      </header>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        </div>
        <div className="p-4 sm:p-6">
          <Skeleton className="h-60 w-full rounded-xl sm:h-64" />
        </div>
      </div>

      <div className="mt-7">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="flex flex-col gap-4 border-b border-slate-100 p-4 last:border-b-0 sm:p-5 md:flex-row md:items-center"
            >
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-64 max-w-full" />
                <Skeleton className="mt-2 h-3 w-36" />
              </div>
              <Skeleton className="h-9 w-40 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </LoadingPage>
  );
}
