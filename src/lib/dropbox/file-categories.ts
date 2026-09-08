export const DROPBOX_FILE_CATEGORY_OPTIONS = [
  { value: "pdf", label: "PDF", extensions: ["pdf"] },
  { value: "document", label: "Document", extensions: ["doc", "docx"] },
  { value: "spreadsheet", label: "Spreadsheet", extensions: ["xls", "xlsx"] },
  { value: "presentation", label: "Presentation", extensions: ["ppt", "pptx"] },
  { value: "image", label: "Image", extensions: ["png", "jpg", "jpeg"] },
  { value: "text", label: "Text / CSV", extensions: ["txt", "csv"] },
  { value: "zip", label: "ZIP", extensions: ["zip"] },
] as const;

export type DropboxFileCategory =
  (typeof DROPBOX_FILE_CATEGORY_OPTIONS)[number]["value"];

export function isDropboxFileCategory(
  value: string
): value is DropboxFileCategory {
  return DROPBOX_FILE_CATEGORY_OPTIONS.some((option) => option.value === value);
}

export function getDropboxFileCategoryExtensions(
  category: DropboxFileCategory | null
): readonly string[] {
  return (
    DROPBOX_FILE_CATEGORY_OPTIONS.find((option) => option.value === category)
      ?.extensions ?? []
  );
}
