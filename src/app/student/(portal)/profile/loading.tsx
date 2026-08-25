import { LoadingPage } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentProfileLoading() {
  return (
    <LoadingPage label="Loading your student profile">
      <header>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-blue-100 bg-white">
          <div className="h-1 bg-blue-100" />
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-6 w-56 max-w-full" />
                <Skeleton className="mt-2 h-4 w-36" />
              </div>
            </div>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-4 w-52 max-w-full" />
            </div>
            <Skeleton className="mt-6 h-10 w-full rounded-lg sm:w-32" />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="grid gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-4 w-40 max-w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-7">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-8 w-24" />
              <Skeleton className="mt-3 h-3 w-44 max-w-full" />
            </div>
          ))}
        </div>
      </section>
    </LoadingPage>
  );
}
