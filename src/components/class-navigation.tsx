"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  classId: number;
};

export default function ClassNavigation({
  classId,
}: Props) {
  const pathname = usePathname();
  const basePath = `/classes/${classId}`;

  const items = [
    {
      label: "Overview",
      href: basePath,
      active: pathname === basePath,
    },
    {
      label: "Students",
      href: `${basePath}/students`,
      active: pathname.startsWith(
        `${basePath}/students`
      ),
    },
    {
      label: "Attendance",
      href: `${basePath}/attendance`,
      active: pathname.startsWith(
        `${basePath}/attendance`
      ),
    },
    {
      label: "Quizzes",
      href: `${basePath}/quizzes`,
      active: pathname.startsWith(
        `${basePath}/quizzes`
      ),
    },
    {
      label: "Laboratories",
      href: `${basePath}/laboratories`,
      active: pathname.startsWith(
        `${basePath}/laboratories`
      ),
    },
    {
      label: "Dropbox",
      href: `${basePath}/dropbox`,
      active: pathname.startsWith(
        `${basePath}/dropbox`
      ),
    },
  ];

  return (
    <nav
      aria-label="Class sections"
      className="-mx-4 mt-6 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:mt-8 sm:px-0"
    >
      <div className="flex min-w-max gap-5 sm:gap-7">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={
              item.active ? "page" : undefined
            }
            className={
              item.active
                ? "border-b-2 border-blue-600 px-1 pb-3 text-sm font-semibold text-blue-700 transition-colors"
                : "border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            }
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
