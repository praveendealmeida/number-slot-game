"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useUser } from "@/context/UserContext";
import { ProfileResponse, apiFetch } from "@/lib/api-client";
import { formatRs } from "@/lib/format";
import { formatSlotNumber } from "@/lib/slots";

function initials(name: string | null, email: string): string {
  const source = (name ?? email ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function outcomeLabel(outcome: string) {
  if (outcome === "WON") return "🏆 Won";
  if (outcome === "LOST") return "Lost";
  return "Pending";
}

function outcomeClass(outcome: string) {
  if (outcome === "WON")
    return "border border-gold/40 bg-gold/10 text-gold shadow-[0_0_16px_rgba(250,204,21,0.15)]";
  if (outcome === "LOST") return "border border-line bg-line/40 text-low";
  return "border border-orange/30 bg-orange/10 text-orange";
}

export default function ProfilePage() {
  const { user, loading } = useUser();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    apiFetch<ProfileResponse>("/api/me/tickets")
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [user]);

  if (!loading && !user) {
    return (
      <AppShell title="My Profile" subtitle="Purchased tickets and win/loss history.">
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-mid">
          Sign in above to view your tickets.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="My Profile" subtitle="Purchased tickets and win/loss history.">
      {user ? (
        <section className="flex items-center gap-4 rounded-2xl border border-line bg-gradient-to-b from-card-soft to-card p-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-gold/50 bg-gradient-to-br from-royal to-royal-soft text-xl font-bold text-hi shadow-[0_0_24px_rgba(91,33,182,0.4)]">
            {initials(user.name, user.email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-hi">
              {user.name ?? user.email}
            </p>
            <p className="truncate text-xs text-low">{user.email}</p>
            {user.role === "ADMIN" ? (
              <span className="mt-1 inline-block rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-gold">
                ADMIN
              </span>
            ) : (
              <span className="mt-1 inline-block rounded-full border border-royal-tint/30 bg-royal/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-royal-tint">
                PLAYER
              </span>
            )}
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-orange/30 bg-orange/10 p-4 text-sm text-orange">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="grid grid-cols-2 gap-3">
            <StatCard label="Tickets" value={String(data.summary.totalTickets)} accent="royal" />
            <StatCard label="Spent" value={formatRs(data.summary.totalSpent)} accent="green" />
            <StatCard label="Wins" value={String(data.summary.wins)} accent="gold" />
            <StatCard
              label="Winnings"
              value={formatRs(data.summary.totalWinnings)}
              accent="gold"
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-[2px] w-3.5 rounded-full bg-orange" />
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-mid">
                My Purchased Tickets
              </h2>
            </div>
            {data.tickets.length === 0 ? (
              <p className="rounded-2xl border border-line bg-card p-4 text-sm text-mid">
                No tickets yet. Visit the lobby to buy your first slot.
              </p>
            ) : null}
            {data.tickets.map((ticket) => (
              <article
                key={ticket.id}
                className="rounded-2xl border border-line bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="num text-lg font-black text-hi">
                      #{ticket.slotLabel}
                    </p>
                    <p className="text-sm text-mid">{ticket.game.title}</p>
                    <Link
                      href={`/games/${ticket.game.id}`}
                      className="text-xs font-semibold text-royal-tint hover:text-gold"
                    >
                      View game
                    </Link>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${outcomeClass(ticket.outcome)}`}
                  >
                    {outcomeLabel(ticket.outcome)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="num text-mid">Paid {formatRs(ticket.pricePaid)}</span>
                  {ticket.isWinner ? (
                    <span className="num font-extrabold text-gold [text-shadow:0_0_12px_rgba(250,204,21,0.3)]">
                      Won {formatRs(ticket.winAmount)}
                    </span>
                  ) : null}
                  {ticket.game.status === "DRAWN" && ticket.game.winningNumber !== null ? (
                    <span className="num text-low">
                      Draw: {formatSlotNumber(ticket.game.winningNumber)}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </>
      ) : (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-mid">
          Loading profile...
        </p>
      )}
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "royal" | "green" | "gold";
}) {
  const accentClass = {
    royal: "text-royal-tint",
    green: "text-green",
    gold: "text-gold",
  }[accent];

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-low">
        {label}
      </p>
      <p className={`num mt-1 text-lg font-black ${accentClass}`}>{value}</p>
    </div>
  );
}
