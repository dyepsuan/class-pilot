import type { ReactNode } from "react";

import { DashboardAuthenticatedHeader } from "@/components/authenticated-header";

export default function DashboardClassesLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <DashboardAuthenticatedHeader />
      {children}
    </>
  );
}
