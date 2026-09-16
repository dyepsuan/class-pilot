import { instructorClassFileResponse } from "@/lib/class-files/responses";

type Props = { params: Promise<{ classId: string; fileId: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { classId, fileId } = await params;
  return instructorClassFileResponse(classId, fileId, false);
}
