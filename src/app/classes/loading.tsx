import {
  CardGridSkeleton,
  LoadingPage,
  PageHeaderSkeleton,
  SectionSkeleton,
  StatsGridSkeleton,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClassesLoading() {
  return (
    <main className="min-h-screen bg-transparent">
      <LoadingPage
        label="Loading classes dashboard"
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
      >
        <PageHeaderSkeleton wideTitle />
        <div className="mt-8">
          <Skeleton className="h-5 w-64 max-w-full" />
          <div className="mt-3 rounded-xl border border-gray-200 bg-white px-5 py-4 sm:px-6">
            <Skeleton className="h-4 w-56 max-w-full bg-gray-100" />
          </div>
        </div>
        <StatsGridSkeleton />
        <div className="mt-10">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full bg-gray-100" />
          <div className="mt-4">
            <CardGridSkeleton count={4} />
          </div>
        </div>
        <SectionSkeleton className="mt-10" rows={6} />
      </LoadingPage>
    </main>
  );
}
