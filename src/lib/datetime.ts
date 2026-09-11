export const PHILIPPINE_TIME_ZONE = "Asia/Manila";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SQLITE_UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/u;
const ISO_TIMESTAMP_WITHOUT_ZONE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/u;

export type StoredTimestamp = string | Date | null | undefined;

export function parseStoredTimestamp(value: StoredTimestamp): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00+08:00`);
  }

  if (SQLITE_UTC_TIMESTAMP_PATTERN.test(trimmed)) {
    return new Date(`${trimmed.replace(" ", "T")}Z`);
  }

  if (ISO_TIMESTAMP_WITHOUT_ZONE_PATTERN.test(trimmed)) {
    return new Date(`${trimmed}Z`);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parsePhilippineDateOnly(value: string | null | undefined): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00+08:00`);
  }

  return parseStoredTimestamp(trimmed);
}

export function formatPhilippineTimestamp(
  value: StoredTimestamp,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone">,
  fallback = "-"
): string {
  const date = parseStoredTimestamp(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-PH", {
    ...options,
    timeZone: PHILIPPINE_TIME_ZONE,
  }).format(date);
}

export function formatPhilippineTime(
  value: StoredTimestamp,
  fallback = "-"
): string {
  return formatPhilippineTimestamp(
    value,
    { hour: "numeric", minute: "2-digit" },
    fallback
  );
}

export function formatPhilippineDateTime(
  value: StoredTimestamp,
  fallback = "-"
): string {
  return formatPhilippineTimestamp(
    value,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
    fallback
  );
}

export function formatPhilippineLongDateTime(
  value: StoredTimestamp,
  fallback = "-"
): string {
  return formatPhilippineTimestamp(
    value,
    {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
    fallback
  );
}

export function formatPhilippineTimestampDate(
  value: StoredTimestamp,
  fallback = "-"
): string {
  return formatPhilippineTimestamp(
    value,
    { month: "long", day: "numeric", year: "numeric" },
    fallback
  );
}

export function formatPhilippineShortTimestampDate(
  value: StoredTimestamp,
  fallback = "-"
): string {
  return formatPhilippineTimestamp(
    value,
    { month: "short", day: "numeric", year: "numeric" },
    fallback
  );
}

export function formatPhilippineDateOnly(
  value: string | null | undefined,
  fallback = "-"
): string {
  const date = parsePhilippineDateOnly(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: PHILIPPINE_TIME_ZONE,
  }).format(date);
}

export function formatPhilippineShortDateOnly(
  value: string | null | undefined,
  fallback = "-"
): string {
  const date = parsePhilippineDateOnly(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: PHILIPPINE_TIME_ZONE,
  }).format(date);
}
