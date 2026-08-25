import type { ReactNode } from "react";

import { AuthenticatedUserProvider } from "@/components/authenticated-user-provider";
import { requireUser } from "@/lib/auth/session";

export default async function ClassesLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await requireUser();

  return (
    <AuthenticatedUserProvider user={user}>
      {children}
    </AuthenticatedUserProvider>
  );
}
