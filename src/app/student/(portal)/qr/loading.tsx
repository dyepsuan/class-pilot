import { LoadingPage } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentQrLoading() {
  return (
    <LoadingPage label="Loading your attendance QR code">
      <header>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </header>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-4 w-48 max-w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-blue-100 bg-white">
        <div className="h-1 bg-blue-100" />
        <div className="px-4 py-7 text-center sm:px-8 sm:py-9">
          <Skeleton className="mx-auto h-5 w-32" />
          <Skeleton className="mx-auto mt-5 aspect-square w-full max-w-[320px] rounded-xl" />
          <Skeleton className="mx-auto mt-5 h-4 w-72 max-w-full" />
          <Skeleton className="mx-auto mt-2 h-3 w-64 max-w-full" />
        </div>
      </div>
    </LoadingPage>
  );
}
