import { notFound } from "next/navigation";

import StudentDropboxFileList from "@/components/student-dropbox-file-list";
import StudentDropboxUploader from "@/components/student-dropbox-uploader";
import { canStudentAccessDropboxClass } from "@/lib/auth/dropbox";
import { requireStudent } from "@/lib/auth/student-session";
import { listDropboxFilesForStudent } from "@/lib/db/dropbox";
import {
  DROPBOX_FILE_INPUT_ACCEPT,
  MAX_DROPBOX_FILENAME_LENGTH,
  MAX_DROPBOX_FILE_SIZE,
} from "@/lib/dropbox/validation";
import { getStudentPortalContext } from "@/lib/student-portal-class";

function formatTerm(term: string): string {
  switch (term) {
    case "1ST_SEMESTER":
      return "1st Semester";
    case "2ND_SEMESTER":
      return "2nd Semester";
    case "SUMMER":
      return "Summer";
    default:
      return term;
  }
}

export default async function StudentDropboxPage() {
  const student = await requireStudent();
  const { selectedClass } = await getStudentPortalContext(student.id);

  if (
    !selectedClass ||
    !(await canStudentAccessDropboxClass(student, selectedClass.id))
  ) {
    notFound();
  }

  const files = await listDropboxFilesForStudent(
    selectedClass.id,
    student.id
  );

  return (
    <div className="w-full">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Dropbox
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Files you upload here are private between you and your instructor.
          </p>
        </div>
        <div className="min-w-0 sm:max-w-sm sm:text-right">
          <p className="break-words text-sm font-semibold text-slate-900">
            {selectedClass.subject_code}: {selectedClass.subject_name}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {selectedClass.section} | SY {selectedClass.school_year} |{" "}
            {formatTerm(selectedClass.term)}
          </p>
        </div>
      </header>

      <div className="mt-6">
        <StudentDropboxUploader
          key={selectedClass.id}
          accept={DROPBOX_FILE_INPUT_ACCEPT}
          maximumFileSize={MAX_DROPBOX_FILE_SIZE}
          maximumFilenameLength={MAX_DROPBOX_FILENAME_LENGTH}
        />
      </div>

      <StudentDropboxFileList
        key={`files-${selectedClass.id}`}
        initialFiles={files}
      />
    </div>
  );
}
