function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />;
}

export default function StudentLaboratoriesLoading() {
  return (
    <div className="w-full" aria-busy="true" aria-label="Loading laboratory results">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </div>
        <div className="sm:text-right">
          <Skeleton className="h-4 w-56 max-w-full sm:ml-auto" />
          <Skeleton className="mt-2 h-4 w-48 max-w-full sm:ml-auto" />
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-9 w-20" />
            <Skeleton className="mt-3 h-3 w-36 max-w-full" />
          </div>
        ))}
      </div>

      <div className="mt-7">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-3 h-6 w-64 max-w-full" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, itemIndex) => (
                  <Skeleton key={itemIndex} className="h-16 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}