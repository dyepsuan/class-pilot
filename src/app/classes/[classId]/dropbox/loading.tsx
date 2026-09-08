import { LoadingPage } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function InstructorDropboxLoading() {
  return (
    <LoadingPage label="Loading class Dropbox" className="w-full">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-9 w-20" />
            <Skeleton className="mt-3 h-3 w-40 max-w-full" />
          </div>
        ))}
      </div>

      <div className="mt-7 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <Skeleton className="h-5 w-32" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>

      <div className="mt-7">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="mt-2 h-4 w-48" />
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="flex flex-col gap-4 border-b border-slate-100 p-4 last:border-b-0 sm:p-5 md:flex-row md:items-center"
            >
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-52 max-w-full" />
                <Skeleton className="mt-2 h-3 w-32" />
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
          ))}
        </div>
      </div>
    </LoadingPage>
  );
}
