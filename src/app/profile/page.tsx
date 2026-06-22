"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useUser } from "@/context/UserContext";
import { ProfileResponse, apiFetch } from "@/lib/api-client";
import { formatRs } from "@/lib/format";
import { formatSlotNumber } from "@/lib/slots";

function outcomeLabel(outcome: string) {
  if (outcome === "WON") return "Won";
  if (outcome === "LOST") return "Lost";
  return "Pending";
}

function outcomeClass(outcome: string) {
  if (outcome === "WON") return "bg-emerald-100 text-emerald-800";
  if (outcome === "LOST") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
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
        <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500">
          Sign in above to view your tickets.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="My Profile" subtitle="Purchased tickets and win/loss history.">
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="grid grid-cols-2 gap-3">
            <StatCard label="Tickets" value={String(data.summary.totalTickets)} />
            <StatCard label="Spent" value={formatRs(data.summary.totalSpent)} />
            <StatCard label="Wins" value={String(data.summary.wins)} />
            <StatCard label="Winnings" value={formatRs(data.summary.totalWinnings)} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              My Purchased Tickets
            </h2>
            {data.tickets.length === 0 ? (
              <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500">
                No tickets yet. Visit the lobby to buy your first slot.
              </p>
            ) : null}
            {data.tickets.map((ticket) => (
              <article
                key={ticket.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-zinc-900">#{ticket.slotLabel}</p>
                    <p className="text-sm text-zinc-500">{ticket.game.title}</p>
                    <Link
                      href={`/games/${ticket.game.id}`}
                      className="text-xs font-medium text-emerald-700"
                    >
                      View game
                    </Link>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${outcomeClass(ticket.outcome)}`}
                  >
                    {outcomeLabel(ticket.outcome)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-600">Paid {formatRs(ticket.pricePaid)}</span>
                  {ticket.isWinner ? (
                    <span className="font-semibold text-emerald-700">
                      Won {formatRs(ticket.winAmount)}
                    </span>
                  ) : null}
                  {ticket.game.status === "DRAWN" && ticket.game.winningNumber !== null ? (
                    <span className="text-zinc-500">
                      Draw: {formatSlotNumber(ticket.game.winningNumber)}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </>
      ) : (
        <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500">Loading profile...</p>
      )}
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-zinc-900">{value}</p>
    </div>
  );
}
