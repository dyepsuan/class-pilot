import Link from "next/link";

export default function StudentClassFilesAttention({ unreadCount }: { unreadCount: number }) {
  if (unreadCount <= 0) return null;
  return (
    <section aria-labelledby="class-files-attention-heading"
      className="mt-7 flex min-w-0 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="class-files-attention-heading" className="text-lg font-bold tracking-tight text-slate-950">Class Files</h2>
          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
            {unreadCount} new class {unreadCount === 1 ? "file" : "files"}
          </span>
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-500">New class materials are available.</p>
      </div>
      <Link href="/student/dropbox?section=class"
        aria-label={`View ${unreadCount} new class ${unreadCount === 1 ? "file" : "files"} in Dropbox`}
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        View files <span aria-hidden="true" className="ml-2">→</span>
      </Link>
    </section>
  );
}
