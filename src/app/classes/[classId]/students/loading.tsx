import {
  LoadingPage,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentsLoading() {
  return (
    <LoadingPage label="Loading students">
      <PageHeaderSkeleton />
      <Skeleton className="mt-6 h-11 w-44 rounded-lg" />
      <div className="mt-6 rounded-xl border border-gray-200 bg-white px-6 py-4">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="mt-6">
        <TableSkeleton columns={5} rows={7} />
      </div>
    </LoadingPage>
  );
}
