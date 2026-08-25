"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import type { AuthUser } from "@/lib/auth/session";

const AuthenticatedUserContext = createContext<AuthUser | null>(null);

export function AuthenticatedUserProvider({
  children,
  user,
}: Readonly<{
  children: ReactNode;
  user: AuthUser;
}>) {
  return (
    <AuthenticatedUserContext.Provider value={user}>
      {children}
    </AuthenticatedUserContext.Provider>
  );
}

export function useAuthenticatedUser(): AuthUser {
  const user = useContext(AuthenticatedUserContext);

  if (!user) {
    throw new Error(
      "useAuthenticatedUser must be used inside AuthenticatedUserProvider."
    );
  }

  return user;
}
