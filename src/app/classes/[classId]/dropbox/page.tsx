import Link from "next/link";
import { notFound } from "next/navigation";

import { getInstructorManagedClass } from "@/lib/auth/instructor-class";
import { requireUser } from "@/lib/auth/session";
import {
  getInstructorDropboxSummary,
  listDropboxFilesForInstructorClass,
  listInstructorDropboxStudentOptions,
  type InstructorDropboxFileListItem,
  type InstructorDropboxStudentOption,
} from "@/lib/db/dropbox";
import {
  DROPBOX_FILE_CATEGORY_OPTIONS,
  isDropboxFileCategory,
  type DropboxFileCategory,
} from "@/lib/dropbox/file-categories";
import {
  formatDropboxFileSize,
  formatDropboxUploadDate,
  getDropboxFileTypeLabel,
} from "@/lib/dropbox/format";

type PageProps = {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{
    q?: string | string[];
    student?: string | string[];
    type?: string | string[];
    page?: string | string[];
  }>;
};

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/u.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function getStudentName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}): string {
  const middleInitial = student.middleName
    ? `${student.middleName.charAt(0)}.`
    : "";

  return [
    `${student.lastName},`,
    student.firstName,
    middleInitial,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200/80 bg-white/95 p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function StudentIdentity({
  file,
}: {
  file: InstructorDropboxFileListItem;
}) {
  return (
    <div className="min-w-0">
      <p className="break-words text-sm font-semibold text-slate-900">
        {getStudentName(file)}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className="text-xs text-slate-500">{file.studentNumber}</p>
        {file.enrollmentStatus && file.enrollmentStatus !== "ACTIVE" && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-200">
            Archived
          </span>
        )}
      </div>
    </div>
  );
}

function DownloadLink({
  classId,
  file,
}: {
  classId: number;
  file: InstructorDropboxFileListItem;
}) {
  return (
    <a
      href={`/api/classes/${classId}/dropbox/${encodeURIComponent(file.id)}/download`}
      aria-label={`Download ${file.displayName} uploaded by ${getStudentName(file)}`}
      className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      Download
    </a>
  );
}

function buildPageHref({
  classId,
  page,
  search,
  studentId,
  fileType,
}: {
  classId: number;
  page: number;
  search: string;
  studentId: number | null;
  fileType: DropboxFileCategory | null;
}): string {
  const query = new URLSearchParams();

  if (search) query.set("q", search);
  if (studentId) query.set("student", String(studentId));
  if (fileType) query.set("type", fileType);
  if (page > 1) query.set("page", String(page));

  const serialized = query.toString();
  return `/classes/${classId}/dropbox${serialized ? `?${serialized}` : ""}`;
}

export default async function InstructorDropboxPage({
  params,
  searchParams,
}: PageProps) {
  const instructor = await requireUser();
  const { classId } = await params;
  const id = Number(classId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    notFound();
  }

  const managedClass = await getInstructorManagedClass(id, instructor);

  if (!managedClass) {
    notFound();
  }

  const query = await searchParams;
  const search = firstQueryValue(query.q).trim().slice(0, 100);
  const requestedStudentId = parsePositiveInteger(
    firstQueryValue(query.student)
  );
  const requestedType = firstQueryValue(query.type).toLowerCase();
  const fileType = isDropboxFileCategory(requestedType)
    ? requestedType
    : null;
  const requestedPage = parsePositiveInteger(firstQueryValue(query.page)) ?? 1;
  const [summary, studentOptions] = await Promise.all([
    getInstructorDropboxSummary(id),
    listInstructorDropboxStudentOptions(id),
  ]);
  const studentId = studentOptions.some(
    (student) => student.studentId === requestedStudentId
  )
    ? requestedStudentId
    : null;
  const listing = await listDropboxFilesForInstructorClass(id, {
    search,
    studentId,
    fileType,
    page: requestedPage,
  });
  const hasFilters = Boolean(search || studentId || fileType);
  const firstVisibleFile =
    listing.totalCount === 0
      ? 0
      : (listing.page - 1) * listing.pageSize + 1;
  const lastVisibleFile = Math.min(
    listing.page * listing.pageSize,
    listing.totalCount
  );

  return (
    <div className="w-full">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Dropbox</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Private files uploaded by students in this class.
          </p>
        </div>
        <p className="max-w-md text-xs leading-5 text-slate-500 sm:text-right">
          Each file is visible only to you and the student who uploaded it.
        </p>
      </header>

      <section
        aria-label="Dropbox summary"
        className="mt-6 grid gap-4 sm:grid-cols-3"
      >
        <SummaryCard
          label="Total Files"
          value={String(summary.totalFiles)}
          detail="Uploaded for this class"
        />
        <SummaryCard
          label="Students with Files"
          value={String(summary.studentsWithFiles)}
          detail="Unique student uploaders"
        />
        <SummaryCard
          label="Storage Used"
          value={formatDropboxFileSize(summary.storageUsed)}
          detail="Based on stored file metadata"
        />
      </section>

      <section
        aria-labelledby="dropbox-filter-heading"
        className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3
            id="dropbox-filter-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Search and filter
          </h3>
        </div>
        <form
          method="get"
          action={`/classes/${id}/dropbox`}
          className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] lg:items-end"
        >
          <div className="min-w-0">
            <label
              htmlFor="dropbox-search"
              className="mb-2 block text-xs font-semibold text-slate-600"
            >
              Search
            </label>
            <input
              id="dropbox-search"
              name="q"
              type="search"
              maxLength={100}
              defaultValue={search}
              placeholder="Search student or file..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="dropbox-student-filter"
              className="mb-2 block text-xs font-semibold text-slate-600"
            >
              Student
            </label>
            <select
              id="dropbox-student-filter"
              name="student"
              defaultValue={studentId ? String(studentId) : ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All students</option>
              {studentOptions.map((student: InstructorDropboxStudentOption) => (
                <option key={student.studentId} value={student.studentId}>
                  {getStudentName(student)} ({student.studentNumber})
                  {student.enrollmentStatus === "ACTIVE" ? "" : " — Archived"}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="dropbox-type-filter"
              className="mb-2 block text-xs font-semibold text-slate-600"
            >
              File type
            </label>
            <select
              id="dropbox-type-filter"
              name="type"
              defaultValue={fileType ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All types</option>
              {DROPBOX_FILE_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lg:flex-none"
            >
              Apply
            </button>
            {hasFilters && (
              <Link
                href={`/classes/${id}/dropbox`}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 lg:flex-none"
              >
                Clear
              </Link>
            )}
          </div>
        </form>
      </section>

      <section aria-labelledby="dropbox-files-heading" className="mt-7">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h3
              id="dropbox-files-heading"
              className="text-lg font-semibold tracking-tight text-slate-950"
            >
              Student Files
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Newest uploads appear first.
            </p>
          </div>
          {listing.totalCount > 0 && (
            <p className="shrink-0 text-sm font-medium text-slate-500">
              {firstVisibleFile}–{lastVisibleFile} of {listing.totalCount}
            </p>
          )}
        </div>

        {summary.totalFiles === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center sm:px-6">
            <div
              aria-hidden="true"
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500"
            >
              D
            </div>
            <h4 className="mt-4 text-sm font-semibold text-slate-900">
              No files yet
            </h4>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              Students have not uploaded any files for this class.
            </p>
          </div>
        ) : listing.files.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center sm:px-6">
            <div
              aria-hidden="true"
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500"
            >
              0
            </div>
            <h4 className="mt-4 text-sm font-semibold text-slate-900">
              No matching files
            </h4>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              Try changing your search or filters.
            </p>
            <Link
              href={`/classes/${id}/dropbox`}
              className="mt-4 inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Clear filters
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden md:block">
              <table className="w-full table-fixed border-collapse">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="w-[24%] px-5 py-3">
                      Student
                    </th>
                    <th scope="col" className="w-[29%] px-4 py-3">
                      File
                    </th>
                    <th scope="col" className="w-[10%] px-4 py-3">
                      Type
                    </th>
                    <th scope="col" className="w-[11%] px-4 py-3">
                      Size
                    </th>
                    <th scope="col" className="w-[15%] px-4 py-3">
                      Uploaded
                    </th>
                    <th scope="col" className="w-[11%] px-4 py-3">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listing.files.map((file) => (
                    <tr
                      key={file.id}
                      className="align-middle hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <StudentIdentity file={file} />
                      </td>
                      <td className="px-4 py-4">
                        <p
                          title={file.displayName}
                          className="truncate text-sm font-semibold text-slate-900"
                        >
                          {file.displayName}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-600">
                        {getDropboxFileTypeLabel(file.originalFilename)}
                      </td>
                      <td className="px-4 py-4 text-sm tabular-nums text-slate-600">
                        {formatDropboxFileSize(file.fileSize)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <time dateTime={file.createdAt}>
                          {formatDropboxUploadDate(file.createdAt)}
                        </time>
                      </td>
                      <td className="px-4 py-4">
                        <DownloadLink classId={id} file={file} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {listing.files.map((file) => (
                <article key={file.id} className="p-4 sm:p-5">
                  <p className="break-words text-sm font-semibold leading-5 text-slate-900">
                    {file.displayName}
                  </p>
                  <div className="mt-2">
                    <StudentIdentity file={file} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {getDropboxFileTypeLabel(file.originalFilename)}
                    </span>
                    <span aria-hidden="true">&bull;</span>
                    <span>{formatDropboxFileSize(file.fileSize)}</span>
                    <span aria-hidden="true">&bull;</span>
                    <time dateTime={file.createdAt}>
                      {formatDropboxUploadDate(file.createdAt)}
                    </time>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <DownloadLink classId={id} file={file} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {listing.totalPages > 1 && (
          <nav
            aria-label="Dropbox file pages"
            className="mt-5 flex items-center justify-between gap-4"
          >
            {listing.page > 1 ? (
              <Link
                href={buildPageHref({
                  classId: id,
                  page: listing.page - 1,
                  search,
                  studentId,
                  fileType,
                })}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            <p className="text-sm text-slate-500">
              Page {listing.page} of {listing.totalPages}
            </p>
            {listing.page < listing.totalPages ? (
              <Link
                href={buildPageHref({
                  classId: id,
                  page: listing.page + 1,
                  search,
                  studentId,
                  fileType,
                })}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
