"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Dashboard", href: "/student" },
  { label: "Attendance", href: "/student/attendance" },
  { label: "Quizzes", href: "/student/quizzes" },
  { label: "Laboratories", href: "/student/laboratories" },
  { label: "Dropbox", href: "/student/dropbox" },
  { label: "My QR", href: "/student/qr" },
  { label: "Profile", href: "/student/profile" },
];

export default function StudentNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Student portal sections"
      className="overflow-x-auto border-t border-slate-100"
    >
      <div className="mx-auto flex min-w-max max-w-6xl gap-5 px-4 sm:gap-7 sm:px-6">
        {items.map((item) => {
          const active =
            item.href === "/student"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "border-b-2 border-blue-600 px-0.5 py-3 text-sm font-semibold text-blue-700"
                  : "border-b-2 border-transparent px-0.5 py-3 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
