"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";

import {
  isDropboxBatchSizeAllowed,
  MAX_DROPBOX_FILES_PER_BATCH,
} from "@/lib/dropbox/upload-rules";

type UploadFailure = {
  filename: string;
  message: string;
};

type UploadResponse = {
  message?: string;
  uploadedCount?: number;
  failedCount?: number;
  failures?: UploadFailure[];
};

type UploadFeedback = {
  tone: "success" | "warning" | "error";
  message: string;
  failures: UploadFailure[];
};

function getExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 && lastDot < filename.length - 1
    ? filename.slice(lastDot + 1).toLowerCase()
    : null;
}

export default function StudentDropboxUploader({
  accept,
  maximumFileSize,
  maximumFilenameLength,
}: {
  accept: string;
  maximumFileSize: number;
  maximumFilenameLength: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const uploadingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<UploadFeedback | null>(null);
  const allowedExtensions = new Set(
    accept.split(",").map((value) => value.trim().replace(/^\./u, ""))
  );

  async function uploadFiles(files: File[]) {
    if (uploadingRef.current) {
      return;
    }

    setFeedback(null);

    if (!isDropboxBatchSizeAllowed(files.length)) {
      setFeedback({
        tone: "error",
        message: `Choose between 1 and ${MAX_DROPBOX_FILES_PER_BATCH} files per upload.`,
        failures: [],
      });
      return;
    }

    const localFailures: UploadFailure[] = [];
    const acceptedFiles = files.filter((file) => {
      const normalizedFilename = file.name.trim();

      if (
        normalizedFilename.length === 0 ||
        normalizedFilename.length > maximumFilenameLength
      ) {
        localFailures.push({
          filename: file.name || "Unnamed file",
          message: `Filenames must be ${maximumFilenameLength} characters or fewer.`,
        });
        return false;
      }

      if (file.size === 0) {
        localFailures.push({
          filename: file.name,
          message: "Empty files cannot be uploaded.",
        });
        return false;
      }

      if (file.size > maximumFileSize) {
        localFailures.push({
          filename: file.name,
          message: "Files must be 25 MB or smaller.",
        });
        return false;
      }

      const extension = getExtension(file.name);

      if (!extension || !allowedExtensions.has(extension)) {
        localFailures.push({
          filename: file.name,
          message: "That file type is not supported.",
        });
        return false;
      }

      return true;
    });

    if (acceptedFiles.length === 0) {
      setFeedback({
        tone: "error",
        message: "No files were uploaded.",
        failures: localFailures,
      });
      return;
    }

    const body = new FormData();
    acceptedFiles.forEach((file) => body.append("files", file));
    uploadingRef.current = true;
    setUploading(true);

    try {
      const response = await fetch("/api/student/dropbox", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as UploadResponse;

      if (!response.ok) {
        const failures = [...localFailures, ...(result.failures ?? [])];
        setFeedback({
          tone: "error",
          message: result.message || "Could not upload the selected files.",
          failures,
        });
        return;
      }

      const uploadedCount = result.uploadedCount ?? 0;
      const failures = [...localFailures, ...(result.failures ?? [])];
      const failedCount = failures.length;
      const message =
        failedCount === 0
          ? result.message ||
            `${uploadedCount} ${
              uploadedCount === 1 ? "file" : "files"
            } uploaded successfully.`
          : `${uploadedCount} ${
              uploadedCount === 1 ? "file" : "files"
            } uploaded. ${failedCount} ${
              failedCount === 1 ? "file" : "files"
            } could not be uploaded.`;

      setFeedback({
        tone:
          uploadedCount > 0
            ? failedCount > 0
              ? "warning"
              : "success"
            : "error",
        message,
        failures,
      });

      if (uploadedCount > 0) {
        router.refresh();
      }
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not upload files right now. Please try again.",
        failures: localFailures,
      });
    } finally {
      uploadingRef.current = false;
      setUploading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    void uploadFiles(Array.from(event.currentTarget.files ?? []));
  }

  function enterDropZone(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (uploading) {
      return;
    }

    dragDepthRef.current += 1;
    setDragging(true);
  }

  function leaveDropZone(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setDragging(false);
    }
  }

  function dropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragging(false);

    if (!uploading) {
      void uploadFiles(Array.from(event.dataTransfer.files));
    }
  }

  const feedbackClasses = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
  };

  return (
    <section
      aria-labelledby="dropbox-upload-heading"
      aria-busy={uploading}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <h2
          id="dropbox-upload-heading"
          className="text-lg font-bold tracking-tight text-slate-950"
        >
          Upload Files
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Add up to 10 files at a time for your current class.
        </p>
      </div>

      <div className="p-4 sm:p-6">
        <div
          onDragEnter={enterDropZone}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={leaveDropZone}
          onDrop={dropFiles}
          className={`flex min-h-60 flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-9 text-center transition sm:min-h-64 ${
            dragging
              ? "border-blue-500 bg-blue-50"
              : "border-slate-300 bg-slate-50/60"
          } ${uploading ? "cursor-wait opacity-70" : ""}`}
        >
          <div
            aria-hidden="true"
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              dragging
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <path
                d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="mt-4 text-base font-semibold text-slate-900">
            {uploading
              ? "Uploading..."
              : dragging
                ? "Drop files to upload"
                : "Drop files here"}
          </p>
          {!uploading && (
            <>
              <p className="mt-1 text-sm text-slate-500">or</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-3 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Choose Files
              </button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            name="files"
            multiple
            accept={accept}
            disabled={uploading}
            onChange={selectFiles}
            className="sr-only"
            aria-label="Choose Dropbox files to upload"
          />
          <p className="mt-5 max-w-lg text-xs leading-5 text-slate-500">
            PDF, Office documents, images, text, CSV, and ZIP &bull; Maximum
            25 MB each
          </p>
        </div>

        {feedback && (
          <div
            role={feedback.tone === "error" ? "alert" : "status"}
            aria-live="polite"
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${feedbackClasses[feedback.tone]}`}
          >
            <p className="font-semibold">{feedback.message}</p>
            {feedback.failures.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs leading-5">
                {feedback.failures.map((failure, index) => (
                  <li key={`${failure.filename}-${index}`} className="break-words">
                    <span className="font-semibold">{failure.filename}</span>
                    {" \u2014 "}
                    {failure.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
