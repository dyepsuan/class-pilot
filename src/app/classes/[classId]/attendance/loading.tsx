import {
  ListRowsSkeleton,
  LoadingPage,
  PageHeaderSkeleton,
} from "@/components/loading-skeletons";

export default function AttendanceLoading() {
  return (
    <LoadingPage label="Loading attendance sessions">
      <PageHeaderSkeleton />
      <div className="mt-6">
        <ListRowsSkeleton rows={6} />
      </div>
    </LoadingPage>
  );
}
