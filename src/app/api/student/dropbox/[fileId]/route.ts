import { getAuthorizedDropboxFileForStudent } from "@/lib/auth/dropbox";
import { getStudentSession } from "@/lib/auth/student-session";
import { deleteDropboxFile } from "@/lib/dropbox/files";
import { isDropboxFileId } from "@/lib/dropbox/resource-id";
import { logDropboxServerError } from "@/lib/dropbox/logging";
import { executeAuthorizedDropboxDelete } from "@/lib/dropbox/student-operation-rules";

type RouteProps = {
  params: Promise<{ fileId: string }>;
};

function fileNotFound(): Response {
  return Response.json(
    { code: "NOT_FOUND", message: "File not found." },
    { status: 404 }
  );
}

export async function DELETE(
  _request: Request,
  { params }: RouteProps
): Promise<Response> {
  const student = await getStudentSession();

  if (!student) {
    return fileNotFound();
  }

  try {
    const { fileId } = await params;

    if (!isDropboxFileId(fileId)) {
      return fileNotFound();
    }

    const authorizedFile = await getAuthorizedDropboxFileForStudent(
      fileId,
      student
    );
    const result = await executeAuthorizedDropboxDelete({
      authorizedFile,
      deleteFile: deleteDropboxFile,
    });

    if (result === "NOT_FOUND") {
      return fileNotFound();
    }

    if (result === "DELETE_FAILED") {
      return Response.json(
        { code: "DELETE_FAILED", message: "Could not delete the file." },
        { status: 500 }
      );
    }

    return Response.json({
      code: "DELETED",
      message: "File deleted.",
    });
  } catch (error) {
    logDropboxServerError(
      "[ClassPilot student Dropbox delete error]",
      error
    );

    return Response.json(
      {
        code: "SERVER_ERROR",
        message: "Could not delete the file. Please try again.",
      },
      { status: 500 }
    );
  }
}
