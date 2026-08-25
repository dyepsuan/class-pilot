import type { Metadata } from "next";

import StudentSetupPageContent from "./StudentSetupPageContent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Student Account Setup | Class-pilot",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default StudentSetupPageContent;

