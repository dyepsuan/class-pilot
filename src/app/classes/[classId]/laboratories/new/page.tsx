import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import LaboratoryForm from "./LaboratoryForm";

type PageProps = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function NewLaboratoryPage({
  params,
}: PageProps) {
  const { classId } = await params;

  const numericClassId = Number(classId);

  const { env } = getCloudflareContext();

  const lastLaboratory = await env.DB.prepare(
    `
      SELECT lab_no
      FROM laboratories
      WHERE class_id = ?
      ORDER BY lab_no DESC
      LIMIT 1
    `
  )
    .bind(numericClassId)
    .first<{ lab_no: number }>();

  const nextLabNo = lastLaboratory
    ? Number(lastLaboratory.lab_no) + 1
    : 1;

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/classes/${classId}/laboratories`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Laboratories
        </Link>

        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          Create Laboratory
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Create an individual or group laboratory activity.
        </p>
      </div>

      <LaboratoryForm
        classId={classId}
        nextLabNo={nextLabNo}
      />
    </div>
  );
}