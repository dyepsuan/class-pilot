import Link from "next/link";
import { notFound } from "next/navigation";

import { isGmailConfigured } from "@/lib/auth/google-oauth";
import { getInstructorManagedClass } from "@/lib/auth/instructor-class";
import { requireUser } from "@/lib/auth/session";
import { getInstructorGoogleConnection } from "@/lib/db/instructor-google-connections";
import { getStudentSetupLinkRoster } from "@/lib/db/student-setup-links";

import GmailDistributionPanel from "./GmailDistributionPanel";
import SetupLinkManager from "./SetupLinkManager";

type SetupLinksPageProps = {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ gmail?: string | string[] }>;
};

export default async function SetupLinksPage({
  params,
  searchParams,
}: SetupLinksPageProps) {
  const { classId } = await params;
  const query = await searchParams;
  const id = Number(classId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const user = await requireUser();
  const classItem = await getInstructorManagedClass(id, user);

  if (!classItem) {
    notFound();
  }

  const [students, gmailConnection] = await Promise.all([
    getStudentSetupLinkRoster(id),
    getInstructorGoogleConnection(user.id),
  ]);
  const counts = {
    activeStudents: students.length,
    needsSetup: students.filter((student) => !student.hasPortalAccount).length,
    activeLinks: students.filter(
      (student) =>
        !student.hasPortalAccount && student.setupLink?.status === "ACTIVE"
    ).length,
    portalActive: students.filter((student) => student.hasPortalAccount).length,
    missingEmail: students.filter((student) => !student.email?.trim()).length,
  };

  const summaries = [
    { label: "Active Students", value: counts.activeStudents, note: "Current class roster" },
    { label: "Needs Setup", value: counts.needsSetup, note: "No portal PIN yet" },
    { label: "Active Links", value: counts.activeLinks, note: "Unused and unexpired" },
    { label: "Portal Active", value: counts.portalActive, note: "Existing account" },
    { label: "Missing Email", value: counts.missingEmail, note: "Manual copy still available" },
  ];

  return (
    <div>
      <Link
        href={`/classes/${id}/students`}
        className="inline-flex items-center text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <span aria-hidden="true">←</span>
        <span className="ml-2">Back to Students</span>
      </Link>

      <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-blue-700">
            {classItem.subject_code} · {classItem.section}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Student Setup Links
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Generate secure one-time links that allow students to create their
            own Class-pilot PIN.
          </p>
        </div>
        <p className="text-sm text-slate-500">SY {classItem.school_year}</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summaries.map((summary) => (
          <section key={summary.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{summary.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{summary.value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{summary.note}</p>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
        Setup links are private credentials. Each link is shown once, expires
        after 48 hours, and should be shared only with its assigned student.
      </div>

      <GmailDistributionPanel
        classId={id}
        className={`${classItem.subject_code} — ${classItem.subject_name}`}
        instructorName={user.displayName}
        students={students}
        configured={isGmailConfigured()}
        connectedEmail={gmailConnection?.googleEmail ?? null}
        oauthStatus={typeof query.gmail === "string" ? query.gmail : null}
      />

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manual distribution</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-950">Copy individual setup links</h3>
      </div>
      <SetupLinkManager classId={id} students={students} />
    </div>
  );
}
