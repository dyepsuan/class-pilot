"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ConfirmationModal from "@/components/ConfirmationModal";
import ClassFileViewDetails from "@/components/class-file-view-details";
import type { InstructorClassFileListItem } from "@/lib/db/class-files";
import type { InstructorManagedClass } from "@/lib/auth/instructor-class";
import { formatDropboxFileSize, getDropboxFileTypeLabel } from "@/lib/dropbox/format";
import { formatPhilippineDateTime } from "@/lib/datetime";
import { MAX_CLASS_FILE_TITLE_LENGTH, MAX_CLASS_FILE_DESCRIPTION_LENGTH } from "@/lib/class-files/metadata-validation";

type Action = { kind: "upload" } | { kind: "edit" | "replace"; file: InstructorClassFileListItem };
const buttonClass = "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60";
const primaryClass = "inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60";
const fieldClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function InstructorClassFiles({ classId, classes, files, accept, maxSize }: {
  classId: number; classes: InstructorManagedClass[]; files: InstructorClassFileListItem[];
  accept: string; maxSize: number;
}) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [deleteFile, setDeleteFile] = useState<InstructorClassFileListItem | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; warning: boolean } | null>(null);

  useEffect(() => {
    if (action && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    if (!action && dialogRef.current?.open) dialogRef.current.close();
  }, [action]);

  function open(next: Action) {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setError(null);
    setAction(next);
  }

  function close() {
    if (pendingRef.current) return;
    setAction(null);
    setError(null);
    triggerRef.current?.focus();
  }

  async function send(url: string, method: string, body?: BodyInit, json = false) {
    const response = await fetch(url, { method, body,
      headers: json ? { "Content-Type": "application/json" } : undefined });
    const result = await response.json() as { message?: string; cleanupPending?: boolean };
    if (!response.ok) throw new Error(result.message || "Could not complete the file action.");
    setFeedback({ message: result.message || "File updated.", warning: Boolean(result.cleanupPending) });
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pendingRef.current) return;
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (action.kind !== "edit" && file instanceof File && (file.size === 0 || file.size > maxSize)) {
      setError(file.size === 0 ? "Empty files cannot be uploaded." : "Files must be 25 MiB or smaller.");
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    setFeedback(null);
    try {
      const base = `/api/classes/${classId}/class-files`;
      if (action.kind === "upload") {
        await send(base, "POST", data);
        const target = classes.find((item) => String(item.id) === data.get("class"));
        if (target && target.id !== classId) {
          setFeedback({ message: "Class file uploaded to " + target.subject_code + " — " + target.section + ".", warning: false });
        }
      }
      if (action.kind === "edit") await send(`${base}/${action.file.id}`, "PATCH",
        JSON.stringify({ title: data.get("title"), description: data.get("description") }), true);
      if (action.kind === "replace") await send(`${base}/${action.file.id}/replace`, "POST", data);
      setAction(null);
      triggerRef.current?.focus();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not complete the file action.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteFile || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    setFeedback(null);
    try {
      await send(`/api/classes/${classId}/class-files/${deleteFile.id}`, "DELETE");
      setDeleteFile(null);
      triggerRef.current?.focus();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete the file.");
      setDeleteFile(null);
      triggerRef.current?.focus();
    } finally { pendingRef.current = false; setPending(false); }
  }

  return (
    <section aria-labelledby="class-files-heading" aria-busy={pending} className="mt-7">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="class-files-heading" className="text-lg font-semibold tracking-tight text-slate-950">Class Files</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">Learning materials for this class. Newest uploads appear first.</p>
        </div>
        <button type="button" className={primaryClass} onClick={() => open({ kind: "upload" })} disabled={pending}>Upload Class File</button>
      </div>
      {feedback && <div role="status" className={`mb-4 rounded-lg border px-4 py-3 text-sm ${feedback.warning
        ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{feedback.message}</div>}
      {error && !action && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {files.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center sm:px-6">
          <h4 className="text-sm font-semibold text-slate-900">No class files yet</h4>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Upload learning materials, reviewers, templates, or other files for your students.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          {files.map((file) => (
            <article key={file.id} className="flex flex-col gap-4 border-b border-slate-100 p-5 last:border-b-0 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="break-words text-xs font-medium text-slate-500">{file.originalFilename}</p>
                <h4 className="mt-1 break-words text-base font-semibold text-slate-950">{file.title}</h4>
                {file.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{file.description}</p>}
                <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">{getDropboxFileTypeLabel(file.originalFilename)}</span>
                  <span aria-hidden="true">·</span><span>{formatDropboxFileSize(file.fileSize)}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={file.createdAt}>Uploaded {formatPhilippineDateTime(file.createdAt)}</time>
                </div>
                <ClassFileViewDetails classId={classId} fileId={file.id} title={file.title}
                  viewedCount={file.viewedCount} activeStudentCount={file.activeStudentCount} />
              </div>
              <div className="flex shrink-0 flex-wrap gap-2" aria-label={`Actions for ${file.title}`}>
                <a className={buttonClass + " border-blue-200 text-blue-700"} href={`/api/classes/${classId}/class-files/${file.id}/view`} target="_blank" rel="noopener noreferrer">View</a>
                <a className={buttonClass} href={`/api/classes/${classId}/class-files/${file.id}/download`}>Download</a>
                <details className="relative">
                  <summary className={buttonClass + " cursor-pointer list-none"}>Manage<span className="ml-1" aria-hidden="true">⌄</span></summary>
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                    {(["edit", "replace", "delete"] as const).map((kind) => (
                      <button key={kind} type="button" disabled={pending}
                        className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 disabled:opacity-60 ${kind === "delete" ? "text-red-700" : "text-slate-700"}`}
                        onClick={(event) => {
                          event.currentTarget.closest("details")?.removeAttribute("open");
                          if (kind === "delete") {
                            triggerRef.current = event.currentTarget.closest("details")?.querySelector("summary") as HTMLElement | null;
                            setError(null); setDeleteFile(file);
                          } else {
                            triggerRef.current = event.currentTarget.closest("details")?.querySelector("summary") as HTMLElement | null;
                            setError(null); setAction({ kind, file });
                          }
                        }}>{kind === "edit" ? "Edit" : kind === "replace" ? "Replace" : "Delete"}</button>
                    ))}
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      )}
      <dialog ref={dialogRef} aria-labelledby="class-file-dialog-title"
        onCancel={(event) => { event.preventDefault(); close(); }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-black/40">
        {action && (
          <form key={action.kind === "upload" ? "upload" : action.kind + action.file.id} onSubmit={submit}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 id="class-file-dialog-title" className="text-lg font-semibold text-slate-900">{action.kind === "upload" ? "Upload Class File" : action.kind === "edit" ? "Edit Class File" : "Replace Class File"}</h2>
              <button type="button" aria-label="Close" disabled={pending} onClick={close} className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100">×</button>
            </div>
            <fieldset disabled={pending} className="space-y-5 px-5 py-5 sm:px-6">
              {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
              {action.kind === "upload" && <label className="block text-sm font-semibold text-slate-700">Class
                <select name="class" required defaultValue={String(classId)} className={fieldClass}>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.subject_code} — {item.section} · {item.school_year} · {item.term.replaceAll("_", " ")}</option>)}
                  <option value="all">All Classes ({classes.length})</option>
                </select>
              </label>}
              {action.kind !== "replace" && <>
                <label className="block text-sm font-semibold text-slate-700">Title
                  <input name="title" required maxLength={MAX_CLASS_FILE_TITLE_LENGTH} defaultValue={action.kind === "edit" ? action.file.title : ""} className={fieldClass} />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span>
                  <textarea name="description" rows={3} maxLength={MAX_CLASS_FILE_DESCRIPTION_LENGTH} defaultValue={action.kind === "edit" ? action.file.description || "" : ""} className={fieldClass} />
                </label>
              </>}
              {action.kind === "replace" && <p className="text-sm leading-6 text-slate-600">Replace <strong className="break-words">{action.file.originalFilename}</strong>. The title and description will be kept.</p>}
              {action.kind !== "edit" && <label className="block text-sm font-semibold text-slate-700">{action.kind === "replace" ? "Replacement file" : "File"}
                <input name="file" type="file" accept={accept} required className={fieldClass + " file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-700"} />
                <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">25 MiB maximum. Documents, spreadsheets, presentations, ZIP archives, and images.</span>
              </label>}
            </fieldset>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <button type="button" disabled={pending} onClick={close} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={pending} className={primaryClass}>{pending ? (action.kind === "upload" ? "Uploading…" : action.kind === "replace" ? "Replacing…" : "Saving…") : action.kind === "upload" ? "Upload" : action.kind === "edit" ? "Save changes" : "Replace file"}</button>
            </div>
          </form>
        )}
      </dialog>
      <ConfirmationModal open={Boolean(deleteFile)} title="Delete Class File?"
        description={<>Delete <strong className="break-words">{deleteFile?.title}</strong>? The file and its view records will be permanently removed.</>}
        confirmLabel="Delete file" pendingLabel="Deleting…" variant="danger" pending={pending}
        onConfirm={confirmDelete} onCancel={() => { if (!pendingRef.current) { setDeleteFile(null); triggerRef.current?.focus(); } }} />
    </section>
  );
}
