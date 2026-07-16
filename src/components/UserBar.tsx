"use client";

import { signIn, signOut } from "next-auth/react";
import { useUser } from "@/context/UserContext";

function initials(name: string | null, email: string): string {
  const source = (name ?? email ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserBar() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-card p-3 text-sm text-mid">
        Loading session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-line bg-card p-3">
        <p className="mb-2 text-sm text-mid">
          Sign in to buy tickets and view your history.
        </p>
        <button
          type="button"
          onClick={() => signIn("google")}
          className="w-full rounded-xl bg-gradient-to-b from-orange to-gold px-4 py-2.5 text-sm font-bold text-[#1C1006] shadow-[0_6px_18px_rgba(249,115,22,0.25)] transition hover:scale-[1.02]"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-gold/50 bg-gradient-to-br from-royal to-royal-soft text-xs font-bold text-hi">
          {initials(user.name, user.email)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-hi">
            {user.name ?? user.email}
          </p>
          <p className="text-xs text-low">
            {user.role === "ADMIN" ? (
              <span className="font-semibold text-gold">ADMIN</span>
            ) : (
              "Player"
            )}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => signOut()}
        className="shrink-0 rounded-xl border border-line px-3 py-1.5 text-sm font-medium text-mid transition hover:border-royal hover:text-hi"
      >
        Sign out
      </button>
    </div>
  );
}
