const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type Weekday = (typeof WEEKDAYS)[number];

export type ScheduleMatch = {
  recognized: boolean;
  scheduledToday: boolean;
  meetingTimes: string[];
};

const weekdayPattern = new RegExp(`\\b(${WEEKDAYS.join("|")})\\b`, "gi");
const clock = "(?:0?[1-9]|1[0-2]):[0-5]\\d\\s*(?:AM|PM)";
const timeRangePattern = new RegExp(
  `\\b(${clock})\\s*(?:-|–|—)\\s*(${clock})\\b`,
  "gi"
);

function normalizeClock(value: string) {
  return value.toUpperCase().replace(/\s+/g, " ").trim();
}

function extractTimeRanges(value: string) {
  return Array.from(value.matchAll(timeRangePattern), (match) =>
    `${normalizeClock(match[1])} – ${normalizeClock(match[2])}`
  );
}

export function matchClassSchedule(
  scheduleText: string | null,
  weekday: string
): ScheduleMatch {
  if (!scheduleText?.trim()) {
    return {
      recognized: false,
      scheduledToday: false,
      meetingTimes: [],
    };
  }

  const dayMatches = Array.from(scheduleText.matchAll(weekdayPattern));

  if (dayMatches.length === 0) {
    return {
      recognized: false,
      scheduledToday: false,
      meetingTimes: [],
    };
  }

  const normalizedWeekday = weekday.toLowerCase();
  const targetMatches = dayMatches.filter(
    (match) => match[0].toLowerCase() === normalizedWeekday
  );

  if (targetMatches.length === 0) {
    return {
      recognized: true,
      scheduledToday: false,
      meetingTimes: [],
    };
  }

  const allRanges = extractTimeRanges(scheduleText);
  const firstTimeIndex = scheduleText.search(timeRangePattern);
  const daysShareRanges =
    firstTimeIndex >= 0 &&
    dayMatches.every((match) => (match.index ?? 0) < firstTimeIndex);

  if (daysShareRanges) {
    return {
      recognized: true,
      scheduledToday: true,
      meetingTimes: allRanges,
    };
  }

  const meetingTimes = targetMatches.flatMap((target) => {
    const start = target.index ?? 0;
    const nextDay = dayMatches.find(
      (match) => (match.index ?? 0) > start
    );
    const end = nextDay?.index ?? scheduleText.length;

    return extractTimeRanges(scheduleText.slice(start, end));
  });

  return {
    recognized: true,
    scheduledToday: true,
    meetingTimes: Array.from(new Set(meetingTimes)),
  };
}

export function isSupportedWeekday(value: string): value is Weekday {
  return WEEKDAYS.some(
    (weekday) => weekday.toLowerCase() === value.toLowerCase()
  );
}
