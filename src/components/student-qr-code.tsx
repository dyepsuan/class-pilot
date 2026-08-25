"use client";

import {
  useEffect,
  useRef,
} from "react";

import * as QRCode from "qrcode";

type StudentQrCodeProps = {
  payload: string;
  studentNumber: string;
  allowDownload?: boolean;
  accessibleLabel?: string;
};

export default function StudentQrCode({
  payload,
  studentNumber,
  allowDownload = true,
  accessibleLabel = "Student attendance QR code",
}: StudentQrCodeProps) {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    QRCode.toCanvas(
      canvasRef.current,
      payload,
      {
        width: 320,
        margin: 3,
        errorCorrectionLevel: "M",
      }
    );
  }, [payload]);

  function downloadQr() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const url =
      canvas.toDataURL("image/png");

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `classpilot-${studentNumber}-qr.png`;

    link.click();
  }

  return (
    <div className="flex flex-col items-center">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={accessibleLabel}
          className="h-auto max-w-full"
        />
      </div>

      {allowDownload && (
        <button
          type="button"
          onClick={downloadQr}
          className="mt-5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Download QR
        </button>
      )}
    </div>
  );
}
