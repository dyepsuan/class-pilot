import {
  FormPageSkeleton,
  LoadingPage,
} from "@/components/loading-skeletons";

export default function NewLaboratoryLoading() {
  return (
    <LoadingPage label="Loading laboratory form">
      <FormPageSkeleton fields={3} sections={3} />
    </LoadingPage>
  );
}
