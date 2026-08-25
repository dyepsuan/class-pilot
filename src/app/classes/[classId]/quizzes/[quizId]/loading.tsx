import {
  LoadingPage,
  PageHeaderSkeleton,
  StatsGridSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";

export default function QuizDetailLoading() {
  return (
    <LoadingPage label="Loading quiz scores">
      <PageHeaderSkeleton showBack showAction={false} wideTitle />
      <StatsGridSkeleton />
      <div className="mt-6">
        <TableSkeleton columns={4} rows={7} />
      </div>
    </LoadingPage>
  );
}
