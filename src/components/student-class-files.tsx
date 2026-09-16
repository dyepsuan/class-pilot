import type { StudentClassFileListItem } from "@/lib/db/class-files";
import { formatPhilippineDateTime } from "@/lib/datetime";
import { formatDropboxFileSize, getDropboxFileTypeLabel } from "@/lib/dropbox/format";

export default function StudentClassFiles({ files }: { files: StudentClassFileListItem[] }) {
  if (files.length === 0) return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-8">
      <h2 className="text-base font-semibold text-slate-900">No class files yet</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Your instructor hasn&apos;t shared any files for this class yet.</p>
    </section>
  );
  return (
    <section aria-label="Class Files" className="mt-6 space-y-3">
      {files.map((file) => (
        <article key={file.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-2">
            <p className="min-w-0 break-words text-sm font-semibold text-slate-900">{file.originalFilename}</p>
            {!file.isViewed && <span className="inline-flex shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-blue-700 ring-1 ring-inset ring-blue-200">NEW</span>}
          </div>
          <h2 className="mt-2 break-words text-lg font-bold text-slate-950">{file.title}</h2>
          {file.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{file.description}</p>}
          <p className="mt-3 text-xs leading-6 text-slate-500">
            {getDropboxFileTypeLabel(file.originalFilename)} · {formatDropboxFileSize(file.fileSize)} · Uploaded {formatPhilippineDateTime(file.createdAt)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["view", "download"] as const).map((action) => (
              <a key={action} href={`/api/student/class-files/${encodeURIComponent(file.id)}/${action}`}
                target={action === "view" ? "_blank" : undefined} rel={action === "view" ? "noopener noreferrer" : undefined}
                aria-label={`${action === "view" ? "View" : "Download"} ${file.originalFilename}${action === "view" ? " (opens in a new tab)" : ""}`}
                className="rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                {action === "view" ? "View" : "Download"}
              </a>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
