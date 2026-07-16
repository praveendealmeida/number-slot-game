"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useUser } from "@/context/UserContext";
import {
  FinanceOverview,
  LobbyGame,
  LobbyResponse,
  apiFetch,
} from "@/lib/api-client";
import { formatRs } from "@/lib/format";
import { WINNER_PAYOUT_PERCENT } from "@/lib/payout";
import { formatSlotNumber } from "@/lib/slots";

export default function AdminPage() {
  const { user } = useUser();
  const router = useRouter();

  const [games, setGames] = useState<LobbyGame[]>([]);
  const [finance, setFinance] = useState<FinanceOverview | null>(null);
  const [title, setTitle] = useState("");
  const [ticketPrice, setTicketPrice] = useState("100");
  const [drawInputs, setDrawInputs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAdminData = async () => {
    const [lobby, overview] = await Promise.all([
      apiFetch<LobbyResponse>("/api/games"),
      apiFetch<FinanceOverview>("/api/admin/finance"),
    ]);
    setGames(lobby.games);
    setFinance(overview);
  };

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    if (user?.role === "ADMIN") {
      loadAdminData().catch((err: Error) => setError(err.message));
    }
  }, [user, router]);

  async function createGame(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await apiFetch("/api/games", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || undefined,
          ticketPrice: Number(ticketPrice),
        }),
      });
      setTitle("");
      setMessage("Game created successfully.");
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game.");
    }
  }

  async function closeGame(gameId: string) {
    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/games/${gameId}/close`, { method: "POST" });
      setMessage("Game closed and ready for draw.");
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close game.");
    }
  }

  async function runDraw(gameId: string) {
    setError(null);
    setMessage(null);

    try {
      const result = await apiFetch<{
        winningNumber: number;
        hasWinner: boolean;
        platformRevenue: number;
        payoutAmount: number;
      }>(`/api/games/${gameId}/draw`, {
        method: "POST",
        body: JSON.stringify({ winningNumber: Number(drawInputs[gameId]) }),
      });

      setMessage(
        result.hasWinner
          ? `Draw complete: ${formatSlotNumber(result.winningNumber)} won ${formatRs(result.payoutAmount)}.`
          : `Draw complete: ${formatSlotNumber(result.winningNumber)} had no buyer. Platform keeps ${formatRs(result.platformRevenue)}.`,
      );
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed.");
    }
  }

  if (!user || user.role !== "ADMIN") {
    return (
      <AppShell title="Admin" subtitle="Admin access required.">
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-mid">
          Switch to the Platform Admin demo user to access this dashboard.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin Dashboard" subtitle="Create games, run draws, track revenue.">
      {finance ? (
        <section className="grid grid-cols-2 gap-3">
          <Metric label="Collections" value={formatRs(finance.totals.totalCollections)} />
          <Metric label="Payouts" value={formatRs(finance.totals.totalPayouts)} />
          <Metric
            label="Platform Net"
            value={formatRs(finance.totals.platformNetRevenue)}
          />
          <Metric label="Open Games" value={String(finance.totals.gamesOpen)} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-mid">
          Create Game
        </h2>
        <form onSubmit={createGame} className="space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Game title (optional)"
            className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-hi placeholder:text-low focus:border-royal focus:outline-none"
          />
          <select
            value={ticketPrice}
            onChange={(event) => setTicketPrice(event.target.value)}
            className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-hi placeholder:text-low focus:border-royal focus:outline-none"
          >
            {["100", "200", "500", "1000"].map((price) => (
              <option key={price} value={price}>
                Rs. {price}
              </option>
            ))}
          </select>
          <p className="rounded-lg border border-gold/25 bg-gold/10 px-3 py-2 text-xs text-gold-soft">
            Winner payout is fixed at {WINNER_PAYOUT_PERCENT}% of the pool
            (platform keeps {100 - WINNER_PAYOUT_PERCENT}%) — not
            configurable per game.
          </p>
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-b from-orange to-gold px-4 py-3 text-sm font-extrabold text-[#1C1006] shadow-[0_8px_24px_rgba(249,115,22,0.25)] transition hover:scale-[1.02]"
          >
            Create Game Session
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-mid">
          Close & Draw
        </h2>
        {games
          .filter((game) => game.status === "OPEN" && game.soldCount > 0)
          .map((game) => (
            <article
              key={`close-${game.id}`}
              className="rounded-2xl border border-line bg-card p-4"
            >
              <p className="font-semibold text-hi">{game.title}</p>
              <p className="text-sm text-mid">
                {game.soldCount} slots sold — close to enable draw
              </p>
              <button
                type="button"
                onClick={() => closeGame(game.id)}
                className="mt-3 w-full rounded-xl border border-line px-4 py-2 text-sm font-semibold text-mid transition hover:border-royal hover:text-hi"
              >
                Close Game
              </button>
            </article>
          ))}
        {games
          .filter((game) => game.status === "CLOSED")
          .map((game) => (
            <article
              key={game.id}
              className="rounded-2xl border border-line bg-card p-4"
            >
              <p className="font-semibold text-hi">{game.title}</p>
              <p className="text-sm text-mid">
                {game.soldCount} slots sold — ready to draw
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={drawInputs[game.id] ?? ""}
                  onChange={(event) =>
                    setDrawInputs((current) => ({
                      ...current,
                      [game.id]: event.target.value,
                    }))
                  }
                  placeholder="00-99"
                  className="num w-24 rounded-xl border border-line bg-base px-3 py-2 text-sm text-hi placeholder:text-low focus:border-royal focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => runDraw(game.id)}
                  className="flex-1 rounded-xl bg-gradient-to-b from-orange to-gold px-4 py-2 text-sm font-extrabold text-[#1C1006] transition hover:scale-[1.02]"
                >
                  Enter Winning Number
                </button>
              </div>
            </article>
          ))}
        {games.filter((game) => game.status === "CLOSED").length === 0 ? (
          <p className="rounded-2xl border border-line bg-card p-4 text-sm text-mid">
            No closed games awaiting draw. Games auto-close when all 100 slots sell.
          </p>
        ) : null}
      </section>

      {finance ? (
        <section className="space-y-3">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-mid">
            Financial Overview
          </h2>
          {finance.games.map((game) => (
            <article
              key={game.gameId}
              className="rounded-2xl border border-line bg-card p-4 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-hi">{game.title}</p>
                  <p className="text-mid">{game.status}</p>
                </div>
                <p className="num font-bold text-green">
                  Net {formatRs(game.platformRevenue)}
                </p>
              </div>
              <div className="num mt-2 grid grid-cols-2 gap-2 text-mid">
                <span>Collected: {formatRs(game.totalCollections)}</span>
                <span>
                  Payout: {formatRs(game.payoutAmount)} ({game.payoutPercent}%)
                </span>
                <span>Sold: {game.soldCount}/100</span>
                <span>
                  Winner:{" "}
                  {game.winningNumber !== null
                    ? formatSlotNumber(game.winningNumber)
                    : "—"}
                </span>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {message ? (
        <p className="rounded-2xl border border-green/30 bg-green/10 p-4 text-sm text-green">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-orange/30 bg-orange/10 p-4 text-sm text-orange">
          {error}
        </p>
      ) : null}
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-low">{label}</p>
      <p className="num mt-1 text-base font-black text-gold">{value}</p>
    </div>
  );
}
