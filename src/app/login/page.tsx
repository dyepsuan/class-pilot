import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/classes");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <p className="mb-5 text-center text-sm font-semibold tracking-wide text-blue-700">
          Class-pilot
        </p>
        <section
          aria-labelledby="login-heading"
          className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
            CP
          </div>
          <h1
            id="login-heading"
            className="mt-5 text-2xl font-bold tracking-tight text-gray-950"
          >
            Sign in to Class-pilot
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Sign in to manage your classes, attendance, and assessments.
          </p>

          <LoginForm />
        </section>
      </div>
    </main>
  );
}
