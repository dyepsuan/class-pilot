"use client";

import { useActionState, useState } from "react";

import { studentLogin, type StudentLoginState } from "./actions";

const initialState: StudentLoginState = { error: null };

export default function StudentLoginForm() {
  const [state, formAction, pending] = useActionState(
    studentLogin,
    initialState
  );
  const [showPin, setShowPin] = useState(false);

  return (
    <form action={formAction} className="mt-7 space-y-5">
      <div>
        <label
          htmlFor="student_number"
          className="block text-sm font-medium text-slate-700"
        >
          Student Number
        </label>
        <input
          id="student_number"
          name="student_number"
          type="text"
          autoComplete="username"
          autoCapitalize="characters"
          required
          disabled={pending}
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
          placeholder="Enter your student number"
        />
      </div>

      <div>
        <label htmlFor="pin" className="block text-sm font-medium text-slate-700">
          PIN
        </label>
        <div className="relative mt-2">
          <input
            id="pin"
            name="pin"
            type={showPin ? "text" : "password"}
            autoComplete="current-password"
            inputMode="numeric"
            required
            disabled={pending}
            className="w-full rounded-lg border border-slate-300 bg-white py-3 pr-20 pl-3.5 text-base tracking-widest text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
          <button
            type="button"
            onClick={() => setShowPin((visible) => !visible)}
            disabled={pending}
            aria-pressed={showPin}
            className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-xs font-semibold text-blue-700 transition hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showPin ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:translate-y-px focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
