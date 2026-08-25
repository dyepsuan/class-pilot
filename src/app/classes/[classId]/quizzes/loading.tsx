import {
  CardGridSkeleton,
  LoadingPage,
  PageHeaderSkeleton,
} from "@/components/loading-skeletons";

export default function QuizzesLoading() {
  return (
    <LoadingPage label="Loading quizzes">
      <PageHeaderSkeleton />
      <div className="mt-6">
        <CardGridSkeleton count={6} />
      </div>
    </LoadingPage>
  );
}
