"use client";

import { useState } from "react";

type CollapsibleGroupScoresProps = {
  children: React.ReactNode;
};

export default function CollapsibleGroupScores({
  children,
}: CollapsibleGroupScoresProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <div>
          <div className="font-medium text-slate-900">
            Group Scores
          </div>

          <div className="mt-1 text-sm text-slate-500">
            View scores for all laboratory groups.
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <span>
            {open ? "Hide Scores" : "View All Scores"}
          </span>

          <span
            className={`text-lg transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            ↓
          </span>
        </div>
      </button>

      {open && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
}