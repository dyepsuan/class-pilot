import { matchClassSchedule } from "./class-schedule";
import {
  formatMeetingTimeRange,
  timeToMinutes,
  toClassWeekday,
  type ClassMeeting,
} from "./class-meetings";

type TodayScheduleClass = {
  id: number;
  subject_code: string;
  subject_name: string;
  section: string;
  schedule_text: string | null;
  meetings: ClassMeeting[];
};

export type MeetingState = "CURRENT" | "UPCOMING" | "UNSCHEDULED" | "COMPLETED";

export type TodayScheduleItem<T extends TodayScheduleClass = TodayScheduleClass> = {
  eventKey: string;
  classItem: T;
  meetingTime: string;
  startMinutes: number | null;
  endMinutes: number | null;
};

export type ClassifiedTodayScheduleItem<
  T extends TodayScheduleClass = TodayScheduleClass,
> = TodayScheduleItem<T> & {
  state: MeetingState;
  isCurrent: boolean;
};

const statePriority: Record<MeetingState, number> = {
  CURRENT: 0,
  UPCOMING: 1,
  UNSCHEDULED: 2,
  COMPLETED: 3,
};

function clockToMinutes(hours: string, minutes: string, period: string) {
  let hourValue = Number(hours) % 12;
  if (period.toUpperCase() === "PM") hourValue += 12;
  return hourValue * 60 + Number(minutes);
}

function legacyTimeRangeMinutes(label: string) {
  const match = /\b(\d{1,2}):(\d{2})\s*(AM|PM)\s*(?:-|–|—)\s*(\d{1,2}):(\d{2})\s*(AM|PM)\b/iu.exec(label);
  if (!match) return null;

  return {
    start: clockToMinutes(match[1], match[2], match[3]),
    end: clockToMinutes(match[4], match[5], match[6]),
  };
}

export function classifyTodayMeeting(
  meeting: Pick<TodayScheduleItem, "startMinutes" | "endMinutes">,
  currentMinutes: number
): MeetingState {
  if (meeting.startMinutes === null || meeting.endMinutes === null) {
    return "UNSCHEDULED";
  }
  if (currentMinutes < meeting.startMinutes) return "UPCOMING";
  if (currentMinutes >= meeting.endMinutes) return "COMPLETED";
  return "CURRENT";
}

function deterministicMeetingOrder<T extends TodayScheduleClass>(
  left: TodayScheduleItem<T>,
  right: TodayScheduleItem<T>
) {
  return (
    left.classItem.section.localeCompare(right.classItem.section) ||
    left.classItem.subject_name.localeCompare(right.classItem.subject_name) ||
    left.classItem.subject_code.localeCompare(right.classItem.subject_code) ||
    left.classItem.id - right.classItem.id ||
    left.eventKey.localeCompare(right.eventKey)
  );
}

export function orderTodaySchedule<T extends TodayScheduleClass>(
  schedule: TodayScheduleItem<T>[],
  currentMinutes: number
): ClassifiedTodayScheduleItem<T>[] {
  return schedule
    .map((meeting) => {
      const state = classifyTodayMeeting(meeting, currentMinutes);
      return { ...meeting, state, isCurrent: state === "CURRENT" };
    })
    .sort((left, right) => {
      const priorityDifference =
        statePriority[left.state] - statePriority[right.state];
      if (priorityDifference !== 0) return priorityDifference;

      if (left.state === "COMPLETED" && right.state === "COMPLETED") {
        const endDifference =
          (right.endMinutes ?? -1) - (left.endMinutes ?? -1);
        if (endDifference !== 0) return endDifference;
      } else if (
        left.state !== "UNSCHEDULED" &&
        right.state !== "UNSCHEDULED"
      ) {
        const startDifference =
          (left.startMinutes ?? Number.MAX_SAFE_INTEGER) -
          (right.startMinutes ?? Number.MAX_SAFE_INTEGER);
        if (startDifference !== 0) return startDifference;
      }

      return deterministicMeetingOrder(left, right);
    });
}

export function buildTodaySchedule<T extends TodayScheduleClass>(
  classes: T[],
  classroomDate: { weekday: string; currentMinutes: number }
): ClassifiedTodayScheduleItem<T>[] {
  const todayWeekday = toClassWeekday(classroomDate.weekday);

  const schedule = classes.flatMap<TodayScheduleItem<T>>((classItem) => {
    if (classItem.meetings.length > 0) {
      return classItem.meetings
        .filter((meeting) => meeting.weekday === todayWeekday)
        .map((meeting) => ({
          eventKey: classItem.id + "-" + (meeting.id ?? meeting.start_time + "-" + meeting.end_time),
          classItem,
          meetingTime: formatMeetingTimeRange(meeting),
          startMinutes: timeToMinutes(meeting.start_time),
          endMinutes: timeToMinutes(meeting.end_time),
        }));
    }

    const legacySchedule = matchClassSchedule(
      classItem.schedule_text,
      classroomDate.weekday
    );
    if (!legacySchedule.scheduledToday) return [];

    const meetingTimes = legacySchedule.meetingTimes.length > 0
      ? legacySchedule.meetingTimes
      : ["Time not specified"];

    return meetingTimes.map((meetingTime, index) => {
      const minutes = legacyTimeRangeMinutes(meetingTime);
      return {
        eventKey: "legacy-" + classItem.id + "-" + index,
        classItem,
        meetingTime,
        startMinutes: minutes?.start ?? null,
        endMinutes: minutes?.end ?? null,
      };
    });
  });

  return orderTodaySchedule(schedule, classroomDate.currentMinutes);
}