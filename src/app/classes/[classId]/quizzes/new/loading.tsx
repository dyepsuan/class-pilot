import {
  FormPageSkeleton,
  LoadingPage,
} from "@/components/loading-skeletons";

export default function NewQuizLoading() {
  return (
    <LoadingPage label="Loading quiz form">
      <FormPageSkeleton fields={4} />
    </LoadingPage>
  );
}
