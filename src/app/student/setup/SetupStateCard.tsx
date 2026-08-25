import Link from "next/link";

import type { StudentSetupUnavailableState } from "@/lib/student-setup-types";

const stateContent: Record<
  StudentSetupUnavailableState,
  { title: string; message: string; showLogin: boolean }
> = {
  INVALID: {
    title: "This setup link is invalid.",
    message: "Check that you opened the complete link provided by your instructor.",
    showLogin: false,
  },
  EXPIRED: {
    title: "This setup link has expired.",
    message: "Ask your instructor to generate a new setup link.",
    showLogin: false,
  },
  REVOKED: {
    title: "This setup link is no longer active.",
    message: "Ask your instructor to generate a new setup link.",
    showLogin: false,
  },
  USED: {
    title: "This setup link has already been used.",
    message: "Your Class-pilot account may already be active.",
    showLogin: true,
  },
  ACCOUNT_ACTIVE: {
    title: "Your Class-pilot account is already active.",
    message: "Sign in with your student number and existing PIN.",
    showLogin: true,
  },
  UNAVAILABLE: {
    title: "This setup link is unavailable.",
    message: "Ask your instructor to confirm your enrollment and provide a new link.",
    showLogin: false,
  },
};

export default function SetupStateCard({
  state,
}: {
  state: StudentSetupUnavailableState;
}) {
  const content = stateContent[state];

  return (
    <section
      aria-labelledby="student-setup-state-heading"
      className="rounded-2xl border border-blue-100 bg-white p-6 text-center shadow-sm sm:p-8"
    >
      <p className="text-sm font-semibold text-blue-700">Student Portal</p>
      <h1
        id="student-setup-state-heading"
        className="mt-2 text-2xl font-bold tracking-tight text-slate-950"
      >
        {content.title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">{content.message}</p>
      {content.showLogin && (
        <Link
          href="/student/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          Go to Student Login
        </Link>
      )}
    </section>
  );
}
