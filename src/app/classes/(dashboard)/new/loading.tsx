import {
  FormPageSkeleton,
  LoadingPage,
} from "@/components/loading-skeletons";

export default function NewClassLoading() {
  return (
    <main className="min-h-screen bg-transparent">
      <LoadingPage
        label="Loading class form"
        className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10"
      >
        <FormPageSkeleton fields={8} />
      </LoadingPage>
    </main>
  );
}
