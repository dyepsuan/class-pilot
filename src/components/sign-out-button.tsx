import { logout } from "@/app/logout/actions";

import PendingSubmitButton from "./pending-submit-button";

export default function SignOutButton() {
  return (
    <form action={logout}>
      <PendingSubmitButton
        pendingLabel="Signing out..."
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
      >
        Sign out
      </PendingSubmitButton>
    </form>
  );
}
