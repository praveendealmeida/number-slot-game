"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GameCard } from "@/components/GameCard";
import { apiFetch, LobbyResponse } from "@/lib/api-client";
import { formatRs } from "@/lib/format";

export default function LobbyPage() {
  const [data, setData] = useState<LobbyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<LobbyResponse>("/api/games")
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell
      title="Game Lobby"
      subtitle="Pick a price tier and grab your lucky numbers before they sell out."
    >
      {loading ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500">Loading games...</p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {data?.priceTiers.map((tier) => (
        <section key={tier.ticketPrice} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900">
              {formatRs(tier.ticketPrice)} Games
            </h2>
            <span className="text-xs text-zinc-500">{tier.games.length} active</span>
          </div>
          {tier.games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </section>
      ))}

      {data && data.games.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500">
          No games yet. Ask an admin to create one from the Admin tab.
        </p>
      ) : null}
    </AppShell>
  );
}
