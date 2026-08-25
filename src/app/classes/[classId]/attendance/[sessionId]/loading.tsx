import {
  LoadingPage,
  PageHeaderSkeleton,
  SectionSkeleton,
  StatsGridSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";

export default function AttendanceSessionLoading() {
  return (
    <LoadingPage label="Loading attendance session">
      <PageHeaderSkeleton showBack />
      <StatsGridSkeleton />
      <SectionSkeleton className="mt-6" rows={2} />
      <div className="mt-6">
        <TableSkeleton columns={4} rows={7} />
      </div>
    </LoadingPage>
  );
}
