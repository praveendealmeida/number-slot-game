"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GameCard } from "@/components/GameCard";
import { apiFetch, LobbyGame, LobbyResponse } from "@/lib/api-client";
import { formatRs } from "@/lib/format";
import { WINNER_PAYOUT_PERCENT } from "@/lib/payout";
import { TICKET_PRICE_TIERS } from "@/lib/pricing";

export default function LobbyPage() {
  const [data, setData] = useState<LobbyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      apiFetch<LobbyResponse>("/api/games")
        .then((res) => {
          setData(res);
          setError(null);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));

    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  // Only OPEN games appear on the home page — closed/drawn games roll off
  // automatically once the daily rotation replaces them with a fresh game.
  const openGamesByPrice = useMemo(() => {
    const map = new Map<number, LobbyGame[]>();
    if (!data) return map;
    for (const game of data.games) {
      if (game.status !== "OPEN") continue;
      const list = map.get(game.ticketPrice) ?? [];
      list.push(game);
      map.set(game.ticketPrice, list);
    }
    return map;
  }, [data]);

  // Live combined prize pool: the winner's fixed share of everything
  // currently collected across today's open games — real data, not a fake tick-up.
  const liveJackpot = useMemo(() => {
    if (!data) return 0;
    const collected = data.games
      .filter((game) => game.status === "OPEN")
      .reduce((sum, game) => sum + game.soldCount * game.ticketPrice, 0);
    return Math.floor((collected * WINNER_PAYOUT_PERCENT) / 100);
  }, [data]);

  const activeGameCount = data?.games.filter((game) => game.status === "OPEN").length ?? 0;

  return (
    <AppShell
      title="Lucky Lanka"
      subtitle="Pick a price tier and grab your lucky numbers before they sell out."
    >
      <div className="-mx-4 -mt-4 border-b border-gold/20 bg-gradient-to-b from-royal-deep via-royal to-royal-soft px-4 py-3">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-royal-tint">
            <span className="live-dot" /> Live Combined Prize Pool
          </span>
          <span className="text-[11px] text-royal-tint/80">
            {activeGameCount} active {activeGameCount === 1 ? "game" : "games"}
          </span>
        </div>
        <p className="num flex items-baseline gap-1.5 text-[34px] font-black leading-none text-gold [text-shadow:0_0_24px_rgba(250,204,21,0.35)]">
          <span className="text-[0.42em] font-bold text-gold-soft">Rs.</span>
          {liveJackpot.toLocaleString("en-IN")}
        </p>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-mid">
          Loading games...
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-orange/30 bg-orange/10 p-4 text-sm text-orange">
          {error}
        </p>
      ) : null}

      {!loading && !error
        ? TICKET_PRICE_TIERS.map((price) => {
            const games = openGamesByPrice.get(price) ?? [];
            if (games.length === 0) {
              return null;
            }
            return (
              <section key={price} className="space-y-3">
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-[2px] w-3.5 rounded-full bg-orange" />
                  <h2 className="text-[13px] font-bold uppercase tracking-wide text-mid">
                    {formatRs(price)} Games
                  </h2>
                  <span className="ml-auto text-xs text-low">{games.length} active</span>
                </div>
                {games.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </section>
            );
          })
        : null}

      {!loading && !error && openGamesByPrice.size === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-mid">
          No games open right now — new games roll out automatically every
          day. Check back soon, or ask an admin to create one.
        </p>
      ) : null}
    </AppShell>
  );
}
