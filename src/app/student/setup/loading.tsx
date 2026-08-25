import { Skeleton } from "@/components/ui/skeleton";

export default function StudentSetupLoading() {
  return (
    <main role="status" aria-live="polite" className="flex min-h-[100dvh] items-center justify-center px-4 py-10 sm:px-6">
      <span className="sr-only">Validating student setup link</span>
      <div aria-hidden="true" className="w-full max-w-md">
        <div className="mb-5 flex justify-center"><Skeleton className="h-9 w-36 rounded-lg" /></div>
        <div className="rounded-2xl border border-blue-100 bg-white p-6 sm:p-8">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-72 max-w-full" />
          <Skeleton className="mt-3 h-4 w-full bg-slate-100" />
          <Skeleton className="mt-6 h-24 w-full rounded-xl" />
          <Skeleton className="mt-7 h-12 w-full rounded-lg" />
          <Skeleton className="mt-5 h-12 w-full rounded-lg" />
          <Skeleton className="mt-5 h-12 w-full rounded-lg" />
        </div>
      </div>
    </main>
  );
}
