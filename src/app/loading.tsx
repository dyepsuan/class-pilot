import {
  LoadingPage,
  PageHeaderSkeleton,
  SectionSkeleton,
  StatsGridSkeleton,
} from "@/components/loading-skeletons";

export default function GlobalLoading() {
  return (
    <main className="min-h-screen bg-transparent">
      <LoadingPage
        label="Loading page"
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
      >
        <PageHeaderSkeleton />
        <StatsGridSkeleton count={3} />
        <SectionSkeleton className="mt-6" />
      </LoadingPage>
    </main>
  );
}
