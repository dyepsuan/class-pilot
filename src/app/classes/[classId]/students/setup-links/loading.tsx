import {
  LoadingPage,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function SetupLinksLoading() {
  return (
    <LoadingPage label="Loading student setup links">
      <PageHeaderSkeleton showBack showAction={false} wideTitle />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-12" />
            <Skeleton className="mt-2 h-3 w-28 bg-slate-100" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-14 w-full rounded-xl" />
      <div className="mt-6">
        <TableSkeleton columns={6} rows={7} />
      </div>
    </LoadingPage>
  );
}
