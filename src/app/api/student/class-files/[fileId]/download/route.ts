import { studentClassFileResponse } from "@/lib/class-files/student-responses";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  return studentClassFileResponse((await params).fileId, false);
}
