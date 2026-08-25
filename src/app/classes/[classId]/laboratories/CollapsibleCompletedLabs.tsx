"use client";

import { useState } from "react";

type Props = {
  count: number;
  children: React.ReactNode;
};

export default function CollapsibleCompletedLabs({
  count,
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="font-medium text-slate-900">
            Completed Laboratories
          </div>

          <div className="mt-1 text-sm text-slate-500">
            {count} completed{" "}
            {count === 1 ? "laboratory" : "laboratories"}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-600">
          <span>{open ? "Hide" : "View"}</span>

          <span
            aria-hidden="true"
            className={`text-lg transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            ↓
          </span>
        </div>
      </button>

      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}
