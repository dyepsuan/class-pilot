import {
  LoadingPage,
  PageHeaderSkeleton,
  SectionSkeleton,
  StatsGridSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";

export default function LaboratoryDetailLoading() {
  return (
    <LoadingPage label="Loading laboratory details">
      <PageHeaderSkeleton showBack wideTitle />
      <StatsGridSkeleton />
      <SectionSkeleton className="mt-8" rows={2} />
      <div className="mt-8">
        <TableSkeleton columns={4} rows={7} />
      </div>
    </LoadingPage>
  );
}
