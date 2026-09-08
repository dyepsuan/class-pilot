"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ConfirmationModal from "@/components/ConfirmationModal";
import type { DropboxFileListItem } from "@/lib/db/dropbox";
import {
  formatDropboxFileSize,
  formatDropboxUploadDate,
  getDropboxFileTypeLabel,
} from "@/lib/dropbox/format";

type DeleteResponse = {
  message?: string;
};

function FileActions({
  file,
  deleting,
  onDelete,
}: {
  file: DropboxFileListItem;
  deleting: boolean;
  onDelete: (file: DropboxFileListItem) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/student/dropbox/${encodeURIComponent(file.id)}/download`}
        className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-label={`Download ${file.displayName}`}
      >
        Download
      </a>
      <button
        type="button"
        disabled={deleting}
        onClick={() => onDelete(file)}
        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        aria-label={`Delete ${file.displayName}`}
      >
        Delete
      </button>
    </div>
  );
}

export default function StudentDropboxFileList({
  initialFiles,
}: {
  initialFiles: DropboxFileListItem[];
}) {
  const router = useRouter();
  const [deletedFileIds, setDeletedFileIds] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedFile, setSelectedFile] =
    useState<DropboxFileListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const files = initialFiles.filter((file) => !deletedFileIds.has(file.id));

  async function confirmDelete() {
    if (!selectedFile || deletingRef.current) {
      return;
    }

    deletingRef.current = true;
    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/student/dropbox/${encodeURIComponent(selectedFile.id)}`,
        { method: "DELETE" }
      );
      const result = (await response.json()) as DeleteResponse;

      if (!response.ok) {
        setError(result.message || "Could not delete the file.");
        setSelectedFile(null);
        return;
      }

      const deletedName = selectedFile.displayName;
      setDeletedFileIds((current) => {
        const next = new Set(current);
        next.add(selectedFile.id);
        return next;
      });
      setSelectedFile(null);
      setSuccess(`${deletedName} was deleted.`);
      router.refresh();
    } catch {
      setError("Could not delete the file. Please try again.");
      setSelectedFile(null);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  return (
    <section
      aria-labelledby="dropbox-files-heading"
      aria-busy={deleting}
      className="mt-7"
    >
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h2
            id="dropbox-files-heading"
            className="text-lg font-bold tracking-tight text-slate-950"
          >
            My Files
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Only you and your instructor can access these files.
          </p>
        </div>
        {files.length > 0 && (
          <p className="shrink-0 text-sm font-medium text-slate-500">
            {files.length} {files.length === 1 ? "file" : "files"}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {success}
        </div>
      )}

      {files.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center sm:px-6">
          <div
            aria-hidden="true"
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M7 3.75h6.25L17 7.5v12.75H7V3.75Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M13 3.75V7.5h4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            No files yet
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
            Files you upload for this class will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="hidden md:block">
            <table className="w-full table-fixed border-collapse">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="w-[40%] px-5 py-3">
                    File
                  </th>
                  <th scope="col" className="w-[12%] px-4 py-3">
                    Type
                  </th>
                  <th scope="col" className="w-[13%] px-4 py-3">
                    Size
                  </th>
                  <th scope="col" className="w-[17%] px-4 py-3">
                    Uploaded
                  </th>
                  <th scope="col" className="w-[18%] px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((file) => (
                  <tr key={file.id} className="align-middle hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p
                        className="truncate text-sm font-semibold text-slate-900"
                        title={file.displayName}
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
                      <FileActions
                        file={file}
                        deleting={deleting}
                        onDelete={(nextFile) => {
                          setError(null);
                          setSuccess(null);
                          setSelectedFile(nextFile);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {files.map((file) => (
              <article key={file.id} className="p-4 sm:p-5">
                <p className="break-words text-sm font-semibold leading-5 text-slate-900">
                  {file.displayName}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">
                      Type
                    </dt>
                    <dd className="mt-1 font-medium text-slate-700">
                      {getDropboxFileTypeLabel(file.originalFilename)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">
                      Size
                    </dt>
                    <dd className="mt-1 font-medium tabular-nums text-slate-700">
                      {formatDropboxFileSize(file.fileSize)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">
                      Uploaded
                    </dt>
                    <dd className="mt-1 font-medium text-slate-700">
                      <time dateTime={file.createdAt}>
                        {formatDropboxUploadDate(file.createdAt)}
                      </time>
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <FileActions
                    file={file}
                    deleting={deleting}
                    onDelete={(nextFile) => {
                      setError(null);
                      setSuccess(null);
                      setSelectedFile(nextFile);
                    }}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <ConfirmationModal
        open={selectedFile !== null}
        title="Delete file?"
        description={
          selectedFile ? (
            <>
              <span className="break-all font-semibold text-slate-900">
                &ldquo;{selectedFile.displayName}&rdquo;
              </span>{" "}
              will be permanently deleted.
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        pending={deleting}
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          setError(null);
          setSelectedFile(null);
        }}
      />
    </section>
  );
}
