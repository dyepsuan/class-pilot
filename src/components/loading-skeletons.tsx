import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function LoadingPage({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function PageHeaderSkeleton({
  showBack = false,
  showAction = true,
  wideTitle = false,
}: {
  showBack?: boolean;
  showAction?: boolean;
  wideTitle?: boolean;
}) {
  return (
    <div>
      {showBack && <Skeleton className="mb-6 h-4 w-32" />}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Skeleton className={`h-7 ${wideTitle ? "w-72" : "w-40"} max-w-full`} />
          <Skeleton className="mt-3 h-4 w-80 max-w-full bg-gray-100" />
        </div>
        {showAction && (
          <Skeleton className="h-10 w-full rounded-lg sm:w-36" />
        )}
      </div>
    </div>
  );
}

export function StatsGridSkeleton({
  count = 4,
}: {
  count?: 3 | 4;
}) {
  return (
    <div
      className={`mt-6 grid gap-4 sm:grid-cols-2 ${
        count === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"
      }`}
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-gray-200 bg-white p-5"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-16" />
          <Skeleton className="mt-2 h-3 w-32 max-w-full bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  columns,
  rows = 6,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {Array.from({ length: columns }, (_, index) => (
                <th key={index} className="px-6 py-3 text-left">
                  <Skeleton className={index === 0 ? "h-3 w-24" : "h-3 w-16"} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: rows }, (_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }, (_, columnIndex) => (
                  <td key={columnIndex} className="px-6 py-4">
                    <Skeleton
                      className={
                        columnIndex === 0
                          ? "h-4 w-40"
                          : columnIndex === columns - 1
                            ? "h-6 w-20 rounded-full"
                            : "h-4 w-24"
                      }
                    />
                    {columnIndex === 0 && (
                      <Skeleton className="mt-2 h-3 w-24 bg-gray-100" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ListRowsSkeleton({
  rows = 6,
}: {
  rows?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center"
          >
            <div className="w-full min-w-0 sm:w-auto">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-2 h-3 w-52 max-w-full bg-gray-100" />
            </div>
            <div className="w-full sm:w-auto">
              <Skeleton className="h-4 w-28 sm:ml-auto" />
              <Skeleton className="mt-2 h-6 w-20 rounded-full sm:ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({
  count = 6,
}: {
  count?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-gray-200 bg-white p-5"
        >
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-6 w-44 max-w-full" />
          <Skeleton className="mt-3 h-3 w-28 bg-gray-100" />
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
            {Array.from({ length: 4 }, (_, statIndex) => (
              <div key={statIndex}>
                <Skeleton className="h-3 w-16 bg-gray-100" />
                <Skeleton className="mt-2 h-4 w-10" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SectionSkeleton({
  rows = 3,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 sm:p-6 ${className}`}
    >
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full bg-gray-100" />
      <div className="mt-6 space-y-4">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton
            key={index}
            className={`h-10 ${index % 2 === 0 ? "w-full" : "w-5/6"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function FormPageSkeleton({
  fields = 4,
  sections = 1,
}: {
  fields?: number;
  sections?: number;
}) {
  return (
    <div>
      <PageHeaderSkeleton showBack showAction={false} />
      <div className="mt-6 space-y-6">
        {Array.from({ length: sections }, (_, sectionIndex) => (
          <div
            key={sectionIndex}
            className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
          >
            {sections > 1 && (
              <>
                <Skeleton className="h-5 w-36" />
                <Skeleton className="mt-2 h-3 w-60 max-w-full bg-gray-100" />
              </>
            )}
            <div className={`${sections > 1 ? "mt-6" : ""} grid gap-6 sm:grid-cols-2`}>
              {Array.from({ length: fields }, (_, fieldIndex) => (
                <div
                  key={fieldIndex}
                  className={fieldIndex === 0 && fields % 2 === 1 ? "sm:col-span-2" : ""}
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-11 w-full rounded-lg" />
                </div>
              ))}
            </div>
            {sectionIndex === sections - 1 && (
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-end">
                <Skeleton className="h-10 w-full rounded-lg sm:w-24" />
                <Skeleton className="h-10 w-full rounded-lg sm:w-36" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
