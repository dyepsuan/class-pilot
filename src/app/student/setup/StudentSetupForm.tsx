"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import type { StudentSetupActionState } from "./actions";
import SetupStateCard from "./SetupStateCard";

type BoundStudentSetupAction = (
  previousState: StudentSetupActionState,
  formData: FormData
) => Promise<StudentSetupActionState>;

const initialStudentSetupActionState: StudentSetupActionState = {
  status: "idle",
};

export default function StudentSetupForm({
  action,
}: {
  action: BoundStudentSetupAction;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialStudentSetupActionState
  );
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [clientErrors, setClientErrors] = useState<{
    pin?: string;
    confirmPin?: string;
  }>({});

  useEffect(() => {
    if (state.status === "success") {
      window.history.replaceState(null, "", "/student/setup");
    }
  }, [state.status]);

  if (state.status === "link-error") {
    return <SetupStateCard state={state.linkState} />;
  }

  if (state.status === "success") {
    return (
      <section
        aria-labelledby="student-setup-success-heading"
        className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm sm:p-8"
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700"
        >
          ✓
        </span>
        <h1
          id="student-setup-success-heading"
          className="mt-4 text-2xl font-bold tracking-tight text-slate-950"
        >
          Your account is ready
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          You can now sign in using your student number and the PIN you just created.
        </p>
        <Link
          href="/student/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          Go to Student Login
        </Link>
      </section>
    );
  }

  const serverFieldErrors =
    state.status === "error" ? state.fieldErrors : undefined;
  const pinError = clientErrors.pin ?? serverFieldErrors?.pin;
  const confirmPinError =
    clientErrors.confirmPin ?? serverFieldErrors?.confirmPin;

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const errors: { pin?: string; confirmPin?: string } = {};

    if (!/^\d{6}$/u.test(pin)) {
      errors.pin = "Enter exactly 6 numeric digits.";
    }

    if (!/^\d{6}$/u.test(confirmPin)) {
      errors.confirmPin = "Re-enter the same 6-digit PIN.";
    } else if (pin !== confirmPin) {
      errors.confirmPin = "The PINs do not match.";
    }

    setClientErrors(errors);

    if (errors.pin || errors.confirmPin) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={validateBeforeSubmit} className="mt-7 space-y-5" noValidate>
      <div>
        <label htmlFor="setup-pin" className="block text-sm font-medium text-slate-700">
          New PIN
        </label>
        <div className="relative mt-2">
          <input
            id="setup-pin"
            name="pin"
            type={showPin ? "text" : "password"}
            value={pin}
            onChange={(event) => {
              setPin(event.target.value);
              setClientErrors((errors) => ({ ...errors, pin: undefined }));
            }}
            autoComplete="new-password"
            inputMode="numeric"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            disabled={pending}
            aria-invalid={Boolean(pinError)}
            aria-describedby={pinError ? "setup-pin-error" : "setup-pin-help"}
            className="w-full rounded-lg border border-slate-300 bg-white py-3 pr-20 pl-3.5 text-base tracking-[0.2em] text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
          <button
            type="button"
            onClick={() => setShowPin((visible) => !visible)}
            disabled={pending}
            aria-pressed={showPin}
            className="absolute inset-y-0 right-0 inline-flex min-h-11 items-center px-3 text-xs font-semibold text-blue-700 transition hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showPin ? "Hide" : "Show"}
          </button>
        </div>
        {pinError ? (
          <p id="setup-pin-error" className="mt-2 text-sm text-red-700">{pinError}</p>
        ) : (
          <p id="setup-pin-help" className="mt-2 text-xs text-slate-500">Exactly 6 digits. Leading zeroes are allowed.</p>
        )}
      </div>

      <div>
        <label htmlFor="setup-pin-confirmation" className="block text-sm font-medium text-slate-700">
          Confirm PIN
        </label>
        <input
          id="setup-pin-confirmation"
          name="confirm_pin"
          type={showPin ? "text" : "password"}
          value={confirmPin}
          onChange={(event) => {
            setConfirmPin(event.target.value);
            setClientErrors((errors) => ({ ...errors, confirmPin: undefined }));
          }}
          autoComplete="new-password"
          inputMode="numeric"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
          disabled={pending}
          aria-invalid={Boolean(confirmPinError)}
          aria-describedby={confirmPinError ? "setup-pin-confirmation-error" : undefined}
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-base tracking-[0.2em] text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
        {confirmPinError && (
          <p id="setup-pin-confirmation-error" className="mt-2 text-sm text-red-700">{confirmPinError}</p>
        )}
      </div>

      {state.status === "error" && (
        <p role="alert" aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <p className="rounded-lg bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600">
        Choose a PIN you can remember. Do not share it with other students.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:translate-y-px focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating account..." : "Create My Account"}
      </button>
    </form>
  );
}
