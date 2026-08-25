"use client";

import Link from "next/link";

import type { AuthUser } from "@/lib/auth/session";

import { useAuthenticatedUser } from "./authenticated-user-provider";
import SignOutButton from "./sign-out-button";

type AuthenticatedHeaderProps =
  | {
      mode: "dashboard";
      user: AuthUser;
    }
  | {
      mode: "class";
      section?: string | null;
    };

function getInstructorIdentity(user: AuthUser) {
  const nameParts = [user.firstName, user.lastName].filter(
    (part): part is string => Boolean(part?.trim())
  );
  const displayName = nameParts.join(" ") || user.email;
  const initials =
    nameParts.length > 0
      ? nameParts
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join("")
      : user.email.charAt(0).toUpperCase();

  return { displayName, initials };
}

export function DashboardAuthenticatedHeader() {
  const user = useAuthenticatedUser();

  return <AuthenticatedHeader mode="dashboard" user={user} />;
}

export default function AuthenticatedHeader(
  props: AuthenticatedHeaderProps
) {
  const instructorIdentity =
    props.mode === "dashboard" ? getInstructorIdentity(props.user) : null;
  const section =
    props.mode === "class" ? props.section?.trim() || "Class" : null;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {props.mode === "class" ? (
          <Link
            href="/classes"
            aria-label="Back to Dashboard"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg text-sm font-medium text-slate-700 transition-colors hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true">←</span>
            <span className="sm:hidden">Dashboard</span>
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Link>
        ) : (
          <Link
            href="/classes"
            aria-label="Class-pilot dashboard"
            className="inline-flex shrink-0 items-center gap-2.5 rounded-lg text-slate-950 transition-colors hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm ring-1 ring-blue-500/20"
            >
              CP
            </span>
            <span className="text-base font-semibold tracking-tight">
              Class-pilot
            </span>
          </Link>
        )}

        {props.mode === "class" ? (
          <p
            title={section ?? undefined}
            className="min-w-0 max-w-[50%] truncate rounded-full bg-blue-50 px-3 py-1.5 text-right text-sm font-semibold text-blue-700 ring-1 ring-blue-100 sm:max-w-xs"
          >
            {section}
          </p>
        ) : (
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 ring-1 ring-blue-100"
            >
              {instructorIdentity?.initials}
            </div>
            <div className="hidden min-w-0 text-right sm:block">
              <p className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                Instructor
              </p>
              <p className="max-w-48 truncate text-sm font-semibold text-slate-900">
                {instructorIdentity?.displayName}
              </p>
            </div>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
