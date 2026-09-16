import "server-only";

import { getAuthorizedInstructorClassFile } from "@/lib/auth/class-files";
import { getCurrentUser } from "@/lib/auth/session";
import { createDropboxContentDisposition } from "@/lib/dropbox/download-headers";
import { logDropboxServerError } from "@/lib/dropbox/logging";
import { getClassFileObject } from "./storage";
import { getSafeClassFileDownloadMimeType } from "./validation";
import { ClassFileOperationError, parseClassFileClassId } from "./metadata-validation";
import { revalidatePath } from "next/cache";

export function classFileNotFound() {
  return Response.json({ code: "NOT_FOUND", message: "File not found." }, { status: 404 });
}

export function classFileErrorResponse(error: unknown) {
  if (error instanceof ClassFileOperationError) {
    return Response.json({ code: error.code, message: error.message }, { status: error.status });
  }
  logDropboxServerError("[ClassPilot Class File operation error]", error);
  return Response.json({ code: "SERVER_ERROR", message: "Could not complete the file action. Please try again." }, { status: 500 });
}

export function refreshClassFilePages(classIds: number[]) {
  for (const id of classIds) revalidatePath(`/classes/${id}/dropbox`);
}

export function isClassFileRequestOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  if (!origin) return true;
  try {
    const url = new URL(request.url);
    // Next dev can normalize request.url to localhost while Host is 127.0.0.1.
    const incomingOrigin = url.protocol + "//" + (request.headers.get("host") || url.host);
    return origin === incomingOrigin;
  } catch { return false; }
}

export async function instructorClassFileResponse(classIdValue: string, id: string, inline: boolean) {
  const user = await getCurrentUser();
  const classId = parseClassFileClassId(classIdValue);
  if (!user || classId === null) return classFileNotFound();
  try {
    const file = await getAuthorizedInstructorClassFile(id, classId, user);
    if (!file) return classFileNotFound();
    const object = await getClassFileObject(file.storageKey);
    if (!object) return classFileNotFound();
    const mime = getSafeClassFileDownloadMimeType(file.mimeType);
    const canInline = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"].includes(mime);
    const disposition = createDropboxContentDisposition(file.originalFilename);
    return new Response(object.body, { headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": inline && canInline ? disposition.replace(/^attachment;/u, "inline;") : disposition,
      "Content-Type": mime,
      "Content-Length": String(object.size),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; base-uri 'none'",
      "Referrer-Policy": "no-referrer",
    } });
  } catch (error) { return classFileErrorResponse(error); }
}


export async function readClassFileFormData(request: Request): Promise<FormData> {
  try { return await request.formData(); }
  catch { throw new ClassFileOperationError("INVALID_REQUEST", "Could not read the uploaded file."); }
}

export async function readClassFileJson(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { throw new ClassFileOperationError("INVALID_REQUEST", "Could not read the file details."); }
}
