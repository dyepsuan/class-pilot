export const CLASS_WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type ClassWeekday = (typeof CLASS_WEEKDAYS)[number];

export type ClassMeeting = {
  id?: number;
  class_id?: number;
  weekday: ClassWeekday;
  start_time: string;
  end_time: string;
  position?: number;
};

export type ClassMeetingBlock = {
  weekdays: ClassWeekday[];
  start_time: string;
  end_time: string;
};

export type MeetingBlockErrors = {
  weekdays?: string;
  start_time?: string;
  end_time?: string;
  block?: string;
};

const weekdayNames: Record<ClassWeekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

const compactWeekdayNames: Record<ClassWeekday, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const normalizedTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isClassWeekday(value: unknown): value is ClassWeekday {
  return (
    typeof value === "string" &&
    CLASS_WEEKDAYS.includes(value as ClassWeekday)
  );
}

export function toClassWeekday(value: string): ClassWeekday | null {
  const normalized = value.trim().toUpperCase();
  return isClassWeekday(normalized) ? normalized : null;
}

export function weekdayOrder(weekday: ClassWeekday) {
  return CLASS_WEEKDAYS.indexOf(weekday);
}

export function timeToMinutes(value: string) {
  if (!normalizedTimePattern.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatMeetingTime(value: string) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value;

  const hours = Math.floor(minutes / 60);
  const minuteValue = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minuteValue).padStart(2, "0")} ${period}`;
}

export function formatMeetingTimeRange(
  meeting: Pick<ClassMeeting, "start_time" | "end_time">
) {
  return `${formatMeetingTime(meeting.start_time)} - ${formatMeetingTime(meeting.end_time)}`;
}

export function sortMeetings<T extends ClassMeeting>(meetings: T[]) {
  return [...meetings].sort(
    (left, right) =>
      weekdayOrder(left.weekday) - weekdayOrder(right.weekday) ||
      left.start_time.localeCompare(right.start_time) ||
      left.end_time.localeCompare(right.end_time) ||
      (left.position ?? 0) - (right.position ?? 0)
  );
}

export type FormattedMeetingGroup = {
  weekdays: ClassWeekday[];
  start_time: string;
  end_time: string;
  label: string;
};

export function groupMeetingsForDisplay(
  meetings: ClassMeeting[],
  options: { compactDays?: boolean } = {}
): FormattedMeetingGroup[] {
  const groups = new Map<string, Omit<FormattedMeetingGroup, "label">>();

  for (const meeting of sortMeetings(meetings)) {
    const key = `${meeting.start_time}|${meeting.end_time}`;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.weekdays.includes(meeting.weekday)) {
        existing.weekdays.push(meeting.weekday);
      }
    } else {
      groups.set(key, {
        weekdays: [meeting.weekday],
        start_time: meeting.start_time,
        end_time: meeting.end_time,
      });
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const weekdays = [...group.weekdays].sort(
        (left, right) => weekdayOrder(left) - weekdayOrder(right)
      );
      const names = options.compactDays ? compactWeekdayNames : weekdayNames;
      return {
        ...group,
        weekdays,
        label: `${weekdays.map((day) => names[day]).join(" / ")} | ${formatMeetingTimeRange(group)}`,
      };
    })
    .sort(
      (left, right) =>
        weekdayOrder(left.weekdays[0]) - weekdayOrder(right.weekdays[0]) ||
        left.start_time.localeCompare(right.start_time)
    );
}

export function formatMeetingSchedule(
  meetings: ClassMeeting[],
  options: { compactDays?: boolean; separator?: string } = {}
) {
  return groupMeetingsForDisplay(meetings, options)
    .map((group) => group.label)
    .join(options.separator ?? "; ");
}

function setBlockError(
  errors: MeetingBlockErrors[],
  index: number,
  key: keyof MeetingBlockErrors,
  message: string
) {
  errors[index] ??= {};
  errors[index][key] ??= message;
}

export function validateMeetingBlocks(blocks: ClassMeetingBlock[]) {
  const blockErrors: MeetingBlockErrors[] = blocks.map(() => ({}));
  const meetings: Array<ClassMeeting & { sourceIndex: number }> = [];

  if (blocks.length === 0) {
    return {
      valid: false,
      meetings,
      blockErrors: [{ block: "Add at least one meeting block." }],
    };
  }

  blocks.forEach((block, sourceIndex) => {
    const weekdays = Array.from(new Set(block.weekdays)).filter(isClassWeekday);
    const startMinutes = timeToMinutes(block.start_time);
    const endMinutes = timeToMinutes(block.end_time);

    if (weekdays.length === 0) {
      setBlockError(blockErrors, sourceIndex, "weekdays", "Select at least one weekday.");
    }
    if (!block.start_time) {
      setBlockError(blockErrors, sourceIndex, "start_time", "Start time is required.");
    } else if (startMinutes === null) {
      setBlockError(blockErrors, sourceIndex, "start_time", "Enter a valid start time.");
    }
    if (!block.end_time) {
      setBlockError(blockErrors, sourceIndex, "end_time", "End time is required.");
    } else if (endMinutes === null) {
      setBlockError(blockErrors, sourceIndex, "end_time", "Enter a valid end time.");
    }
    if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      setBlockError(blockErrors, sourceIndex, "end_time", "End time must be after start time.");
    }

    if (weekdays.length && startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
      weekdays.forEach((weekday) => meetings.push({
        weekday,
        start_time: block.start_time,
        end_time: block.end_time,
        sourceIndex,
      }));
    }
  });

  const seenMeetings = new Map<string, number>();
  meetings.forEach((meeting) => {
    const key = `${meeting.weekday}|${meeting.start_time}|${meeting.end_time}`;
    const previousIndex = seenMeetings.get(key);
    if (previousIndex !== undefined) {
      setBlockError(blockErrors, previousIndex, "block", "This meeting is duplicated in another block.");
      setBlockError(blockErrors, meeting.sourceIndex, "block", "This meeting is duplicated in another block.");
    } else {
      seenMeetings.set(key, meeting.sourceIndex);
    }
  });

  CLASS_WEEKDAYS.forEach((weekday) => {
    const dayMeetings = meetings
      .filter((meeting) => meeting.weekday === weekday)
      .sort((left, right) => left.start_time.localeCompare(right.start_time));

    for (let leftIndex = 0; leftIndex < dayMeetings.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < dayMeetings.length; rightIndex += 1) {
        const left = dayMeetings[leftIndex];
        const right = dayMeetings[rightIndex];
        if (left.start_time === right.start_time && left.end_time === right.end_time) continue;
        if (left.start_time < right.end_time && right.start_time < left.end_time) {
          const message = `${weekdayNames[weekday]} meeting times overlap.`;
          setBlockError(blockErrors, left.sourceIndex, "block", message);
          setBlockError(blockErrors, right.sourceIndex, "block", message);
        }
      }
    }
  });

  return {
    valid: blockErrors.every((errors) => Object.keys(errors).length === 0),
    meetings: sortMeetings(meetings),
    blockErrors,
  };
}

export function parseMeetingBlocks(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    const blocks: ClassMeetingBlock[] = [];
    for (const item of parsed) {
      if (
        typeof item !== "object" || item === null ||
        !("weekdays" in item) || !("start_time" in item) || !("end_time" in item) ||
        !Array.isArray(item.weekdays) ||
        typeof item.start_time !== "string" || typeof item.end_time !== "string"
      ) return null;

      blocks.push({
        weekdays: item.weekdays.filter(isClassWeekday),
        start_time: item.start_time,
        end_time: item.end_time,
      });
    }
    return blocks;
  } catch {
    return null;
  }
}
