export function formatDropboxFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unknown size";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  if (bytes >= 1024 * 1024 * 1024) {
    return `${new Intl.NumberFormat("en-PH", {
      maximumFractionDigits: 1,
    }).format(bytes / (1024 * 1024 * 1024))} GB`;
  }

  return `${new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 1,
  }).format(bytes / (1024 * 1024))} MB`;
}

function parseStoredDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return new Date(`${value}T00:00:00+08:00`);
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }

  return new Date(value);
}

export function formatDropboxUploadDate(value: string): string {
  const date = parseStoredDate(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
}

export function getDropboxFileTypeLabel(filename: string): string {
  const extension = filename.split(".").at(-1)?.trim().toUpperCase();
  return extension || "FILE";
}
