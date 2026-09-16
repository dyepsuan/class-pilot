"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getClassroomDate } from "@/lib/classroom-time";
import {
  orderTodaySchedule,
  type TodayScheduleItem,
} from "@/lib/dashboard-today";

export default function InstructorTodaySchedule({
  dateLabel,
  weekday,
  schedule,
  initialManilaMinutes,
}: {
  dateLabel: string;
  weekday: string;
  schedule: TodayScheduleItem[];
  initialManilaMinutes: number;
}) {
  const router = useRouter();
  const [currentMinutes, setCurrentMinutes] = useState(initialManilaMinutes);
  const orderedSchedule = useMemo(
    () => orderTodaySchedule(schedule, currentMinutes),
    [schedule, currentMinutes]
  );

  useEffect(() => {
    let intervalId: number | undefined;

    const updateScheduleTime = () => {
      const classroomDate = getClassroomDate();
      if (classroomDate.dateLabel !== dateLabel) {
        setCurrentMinutes(24 * 60);
        router.refresh();
        return;
      }
      setCurrentMinutes(classroomDate.currentMinutes);
    };

    updateScheduleTime();
    const millisecondsToNextMinute = 60_000 - (Date.now() % 60_000) + 50;
    const timeoutId = window.setTimeout(() => {
      updateScheduleTime();
      intervalId = window.setInterval(updateScheduleTime, 60_000);
    }, millisecondsToNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [dateLabel, router]);

  return (
    <section
      aria-labelledby="today-heading"
      className="rounded-xl border border-slate-200/80 bg-white/95 p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2
          id="today-heading"
          className="text-xl font-semibold tracking-tight text-slate-950"
        >
          Your classes today
        </h2>
        <p className="mt-1 text-sm text-slate-500">{dateLabel}</p>
      </div>

      {orderedSchedule.length === 0 ? (
        <div className="mt-4 border-t border-slate-200 pb-1 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">
            No classes today
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            You don&apos;t have any scheduled classes for {weekday}.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {orderedSchedule.map(({
            eventKey,
            classItem,
            meetingTime,
            isCurrent,
          }) => (
            <article
              key={eventKey}
              data-meeting-state={isCurrent ? "current" : undefined}
              className={
                "grid min-w-0 gap-3 rounded-lg border px-4 py-3.5 sm:px-4 " +
                "lg:grid-cols-[11rem_minmax(0,1fr)_auto] lg:items-center lg:gap-5 " +
                (isCurrent
                  ? "border-blue-300 bg-blue-50/70 ring-1 ring-blue-100"
                  : "border-slate-200/80 bg-slate-50/40")
              }
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold tabular-nums text-slate-950">
                  {meetingTime}
                </p>
                {isCurrent && (
                  <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-blue-700">
                    NOW
                  </span>
                )}
              </div>

              <div className="min-w-0 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-2 sm:gap-y-1">
                <h3 className="text-base font-semibold text-slate-950">
                  {classItem.section}
                </h3>
                <span
                  aria-hidden="true"
                  className="hidden text-slate-300 sm:inline"
                >
                  ·
                </span>
                <p className="mt-0.5 break-words text-sm text-slate-600 sm:mt-0">
                  <span className="font-medium text-slate-700">
                    {classItem.subject_code}
                  </span>{" "}
                  <span aria-hidden="true">—</span>{" "}
                  {classItem.subject_name}
                </p>
              </div>

              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
                <Link
                  href={"/classes/" + classItem.id}
                  aria-label={"Open " + classItem.section + " class"}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                >
                  Open Class
                </Link>
                <Link
                  href={"/classes/" + classItem.id + "/attendance"}
                  aria-label={"Open attendance for " + classItem.section}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                >
                  Attendance
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}