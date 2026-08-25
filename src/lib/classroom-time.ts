export const CLASSROOM_TIME_ZONE = "Asia/Manila";

export type ClassroomDate = {
  weekday: string;
  dateLabel: string;
};

export function getClassroomDate(now = new Date()): ClassroomDate {
  const parts = new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: CLASSROOM_TIME_ZONE,
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return {
    weekday: part("weekday"),
    dateLabel: `${part("weekday")}, ${part("month")} ${part("day")}`,
  };
}

export function formatClassroomDateTime(value: string) {
  const normalized =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value.replace(" ", "T")}Z`
      : value;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: CLASSROOM_TIME_ZONE,
  }).format(date);
}

export function getSchoolYearOptions(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "numeric",
    timeZone: CLASSROOM_TIME_ZONE,
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const currentStartYear = month >= 6 ? year : year - 1;
  const starts = Array.from({ length: 7 }, (_, index) => currentStartYear - 3 + index);

  return {
    defaultSchoolYear: `${currentStartYear}-${currentStartYear + 1}`,
    schoolYears: starts.map((startYear) => ({
      value: `${startYear}-${startYear + 1}`,
      label: `${startYear}-${startYear + 1}`,
    })),
  };
}
