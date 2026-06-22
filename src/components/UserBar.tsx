"use client";

import { signIn, signOut } from "next-auth/react";
import { useUser } from "@/context/UserContext";

export function UserBar() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-sm text-zinc-500">
        Loading session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
        <p className="mb-2 text-sm text-zinc-600">
          Sign in to buy tickets and view your history.
        </p>
        <button
          type="button"
          onClick={() => signIn("google")}
          className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-900">
          {user.name ?? user.email}
        </p>
        <p className="text-xs text-zinc-500">{user.role}</p>
      </div>
      <button
        type="button"
        onClick={() => signOut()}
        className="shrink-0 rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700"
      >
        Sign out
      </button>
    </div>
  );
}
