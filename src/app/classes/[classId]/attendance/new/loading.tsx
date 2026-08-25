import {
  FormPageSkeleton,
  LoadingPage,
} from "@/components/loading-skeletons";

export default function NewAttendanceLoading() {
  return (
    <LoadingPage label="Loading attendance form">
      <FormPageSkeleton fields={3} />
    </LoadingPage>
  );
}
