import {
  FormPageSkeleton,
  LoadingPage,
} from "@/components/loading-skeletons";

export default function ImportStudentsLoading() {
  return (
    <LoadingPage label="Loading student import">
      <FormPageSkeleton fields={1} sections={2} />
    </LoadingPage>
  );
}
