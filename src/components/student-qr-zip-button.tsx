"use client";

import { useState } from "react";
import JSZip from "jszip";
import * as QRCode from "qrcode";

import type { StudentQrCardData } from "@/components/student-qr-card";

type StudentQrZipButtonProps = {
  students: StudentQrCardData[];
  section: string;
  disabled?: boolean;
};

function sanitizeFilenamePart(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "student"
  );
}

function fitCanvasText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number
): string {
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  let shortened = value;

  while (
    shortened.length > 1 &&
    context.measureText(`${shortened}...`).width > maxWidth
  ) {
    shortened = shortened.slice(0, -1);
  }

  return `${shortened}...`;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not render the QR image."));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create the QR card image."));
    }, "image/png");
  });
}

async function renderPrintableQrCard(
  student: StudentQrCardData & { payload: string }
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1600;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is unavailable.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#2563eb";
  context.fillRect(0, 0, canvas.width, 20);

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#2563eb";
  context.font = "700 42px Arial, sans-serif";
  context.fillText("CLASS-PILOT", 600, 82);

  const qrDataUrl = await QRCode.toDataURL(student.payload, {
    width: 900,
    margin: 4,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  const qrImage = await loadImage(qrDataUrl);
  context.drawImage(qrImage, 150, 145, 900, 900);

  context.fillStyle = "#0f172a";
  context.font = "700 54px Arial, sans-serif";
  context.fillText(
    fitCanvasText(context, student.studentName, 1040),
    600,
    1125
  );

  context.fillStyle = "#475569";
  context.font = "500 36px Arial, sans-serif";
  context.fillText(
    fitCanvasText(context, student.studentNumber, 1040),
    600,
    1195
  );
  context.font = "500 32px Arial, sans-serif";
  context.fillText(
    fitCanvasText(context, `Section: ${student.section}`, 1040),
    600,
    1280
  );
  context.fillText(
    fitCanvasText(context, `Subject: ${student.subject}`, 1040),
    600,
    1335
  );

  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(100, 1415);
  context.lineTo(1100, 1415);
  context.stroke();

  context.fillStyle = "#2563eb";
  context.font = "700 28px Arial, sans-serif";
  context.fillText("ATTENDANCE QR", 600, 1500);

  return canvasToBlob(canvas);
}

export default function StudentQrZipButton({
  students,
  section,
  disabled = false,
}: StudentQrZipButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportStudents = students.filter(
    (student): student is StudentQrCardData & { payload: string } =>
      Boolean(student.payload)
  );
  const canDownload =
    !disabled &&
    students.length > 0 &&
    exportStudents.length === students.length;

  async function downloadZip() {
    if (isGenerating || !canDownload) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const zip = new JSZip();
      const usedFilenames = new Set<string>();

      for (const student of exportStudents) {
        const studentNumber = student.studentNumber.trim();
        const baseName = sanitizeFilenamePart(
          studentNumber
            ? `${studentNumber}-${student.studentName}`
            : `${student.studentName}-${student.studentId}`
        );
        let filename = `${baseName}.png`;

        if (usedFilenames.has(filename.toLowerCase())) {
          filename = `${baseName}-${student.studentId}.png`;
        }

        let collisionIndex = 2;

        while (usedFilenames.has(filename.toLowerCase())) {
          filename = `${baseName}-${student.studentId}-${collisionIndex}.png`;
          collisionIndex += 1;
        }

        usedFilenames.add(filename.toLowerCase());
        zip.file(filename, await renderPrintableQrCard(student));
      }

      const archive = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sanitizeFilenamePart(section)}-student-qr-codes.zip`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (zipError) {
      console.error("Could not generate the student QR ZIP.", zipError);
      setError("The ZIP could not be generated. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch">
      <button
        type="button"
        onClick={downloadZip}
        disabled={isGenerating || !canDownload}
        className="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isGenerating ? "Preparing ZIP..." : "Download ZIP"}
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-xs text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
