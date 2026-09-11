import { formatPhilippineShortTimestampDate } from "@/lib/datetime";

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

export function formatDropboxUploadDate(value: string): string {
  return formatPhilippineShortTimestampDate(value, value);
}

export function getDropboxFileTypeLabel(filename: string): string {
  const extension = filename.split(".").at(-1)?.trim().toUpperCase();
  return extension || "FILE";
}
