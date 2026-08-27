"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import * as QRCode from "qrcode";

import type { StudentQrCardData } from "@/components/student-qr-card";

type StudentQrPdfButtonProps = {
  students: StudentQrCardData[];
  section: string;
};

function sanitizeFilenamePart(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "class"
  );
}

function fitText(doc: jsPDF, value: string, maxWidth: number): string {
  if (doc.getTextWidth(value) <= maxWidth) {
    return value;
  }

  let shortened = value;

  while (shortened.length > 1 && doc.getTextWidth(`${shortened}...`) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }

  return `${shortened}...`;
}

export default function StudentQrPdfButton({
  students,
  section,
}: StudentQrPdfButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyStudents = students.filter(
    (student): student is StudentQrCardData & { payload: string } =>
      Boolean(student.payload)
  );

  async function downloadPdf() {
    if (isGenerating || readyStudents.length === 0) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const pageWidth = 210;
      const pageHeight = 297;
      const pageMargin = 12;
      const columnGap = 8;
      const rowGap = 8;
      const cardWidth = (pageWidth - pageMargin * 2 - columnGap) / 2;
      const cardHeight = (pageHeight - pageMargin * 2 - rowGap) / 2;
      const qrSize = 68;

      for (let index = 0; index < readyStudents.length; index += 1) {
        if (index > 0 && index % 4 === 0) {
          doc.addPage();
        }

        const position = index % 4;
        const column = position % 2;
        const row = Math.floor(position / 2);
        const x = pageMargin + column * (cardWidth + columnGap);
        const y = pageMargin + row * (cardHeight + rowGap);
        const student = readyStudents[index];
        const qrX = x + (cardWidth - qrSize) / 2;
        const qrY = y + 18;
        const qrDataUrl = await QRCode.toDataURL(student.payload, {
          width: 1024,
          margin: 4,
          errorCorrectionLevel: "M",
          color: { dark: "#0f172a", light: "#ffffff" },
        });

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.35);
        doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "S");

        doc.setTextColor(37, 99, 235);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("CLASS-PILOT", x + cardWidth / 2, y + 9, {
          align: "center",
        });

        doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

        const textCenter = x + cardWidth / 2;
        let textY = qrY + qrSize + 8;
        const maxTextWidth = cardWidth - 12;

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.text(fitText(doc, student.studentName, maxTextWidth), textCenter, textY, {
          align: "center",
        });

        textY += 5;
        doc.setTextColor(71, 85, 105);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(
          fitText(doc, student.studentNumber, maxTextWidth),
          textCenter,
          textY,
          { align: "center" }
        );

        textY += 5;
        doc.text(
          fitText(doc, `Section: ${student.section}`, maxTextWidth),
          textCenter,
          textY,
          { align: "center" }
        );

        textY += 4.5;
        doc.text(
          fitText(doc, `Subject: ${student.subject}`, maxTextWidth),
          textCenter,
          textY,
          { align: "center" }
        );

        doc.setTextColor(37, 99, 235);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("ATTENDANCE QR", textCenter, y + cardHeight - 7, {
          align: "center",
        });
      }

      doc.save(`${sanitizeFilenamePart(section)}-student-qr-codes.pdf`);
    } catch (pdfError) {
      console.error("Could not generate the student QR PDF.", pdfError);
      setError("The PDF could not be generated. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch sm:items-end">
      <button
        type="button"
        onClick={downloadPdf}
        disabled={isGenerating || readyStudents.length === 0}
        className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 sm:w-auto"
      >
        {isGenerating ? "Preparing PDF..." : "Print / Download PDF"}
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-xs text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
