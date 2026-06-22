"use client";

import { useSession } from "next-auth/react";
import { AppUser } from "@/lib/api-client";

type UserContextValue = {
  user: AppUser | null;
  loading: boolean;
};

export function useUser(): UserContextValue {
  const { data: session, status } = useSession();

  const user: AppUser | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email ?? "",
        name: session.user.name ?? null,
        role: session.user.role,
      }
    : null;

  return { user, loading: status === "loading" };
}
