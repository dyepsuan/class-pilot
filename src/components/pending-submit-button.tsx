"use client";

import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  children: string;
  pendingLabel: string;
  className: string;
};

export default function PendingSubmitButton({
  children,
  pendingLabel,
  className,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
