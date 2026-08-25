import {
  LoadingPage,
  PageHeaderSkeleton,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentQrLoading() {
  return (
    <LoadingPage label="Loading student QR code">
      <PageHeaderSkeleton showBack showAction={false} />
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
        <Skeleton className="mx-auto h-6 w-48 max-w-full" />
        <Skeleton className="mx-auto mt-3 h-4 w-28 bg-gray-100" />
        <Skeleton className="mx-auto mt-8 aspect-square w-full max-w-72 rounded-xl" />
        <Skeleton className="mx-auto mt-5 h-3 w-64 max-w-full bg-gray-100" />
      </div>
    </LoadingPage>
  );
}
