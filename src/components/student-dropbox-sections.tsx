import Link from "next/link";

export default function StudentDropboxSections({ section }: { section: "class" | "student" }) {
  return (
    <nav aria-label="Dropbox sections" className="mt-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1 sm:w-fit">
      {(["class", "student"] as const).map((value) => (
        <Link key={value} href={`/student/dropbox?section=${value}`}
          aria-current={section === value ? "page" : undefined}
          className={`flex-1 whitespace-nowrap rounded-lg px-5 py-2.5 text-center text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:flex-none ${section === value
            ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/60"
            : "text-slate-600 hover:bg-white/60 hover:text-slate-900"}`}>
          {value === "class" ? "Class Files" : "Student Files"}
        </Link>
      ))}
    </nav>
  );
}
