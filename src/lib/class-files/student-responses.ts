import "server-only";
import { revalidatePath } from "next/cache";
import { markClassFileVersionViewed } from "@/lib/db/class-files";

import { getAuthorizedStudentClassFile } from "@/lib/auth/student-class-files";
import { getStudentSession } from "@/lib/auth/student-session";
import { createDropboxContentDisposition } from "@/lib/dropbox/download-headers";
import { logDropboxServerError } from "@/lib/dropbox/logging";
import { getClassFileObject } from "./storage";
import { getSafeClassFileDownloadMimeType } from "./validation";

function notFound() {
  return Response.json({ code: "NOT_FOUND", message: "File not found." }, {
    status: 404, headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function studentClassFileResponse(id: string, inline: boolean): Promise<Response> {
  try {
    const student = await getStudentSession();
    if (!student) return notFound();
    const file = await getAuthorizedStudentClassFile(id, student);
    if (!file) return notFound();
    const object = await getClassFileObject(file.storageKey);
    if (!object) return notFound();
    const mime = getSafeClassFileDownloadMimeType(file.mimeType);
    const canInline = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"].includes(mime);
    const disposition = createDropboxContentDisposition(file.originalFilename);
    const response = new Response(object.body, { headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": inline && canInline ? disposition.replace(/^attachment;/u, "inline;") : disposition,
      "Content-Type": mime,
      "Content-Length": String(object.size),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; base-uri 'none'",
      "Referrer-Policy": "no-referrer",
    } });
    try {
      if (await markClassFileVersionViewed(file, student.id)) {
        revalidatePath("/student");
        revalidatePath("/student/dropbox");
        revalidatePath(`/classes/${file.classId}/dropbox`);
      }
    } catch (error) {
      logDropboxServerError("[ClassPilot Class File tracking error]", error);
    }
    return response;
  } catch (error) {
    logDropboxServerError("[ClassPilot student Class File response error]", error);
    return Response.json({ code: "SERVER_ERROR", message: "Could not open the file. Please try again." }, {
      status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
