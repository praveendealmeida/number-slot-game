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
import { formatSlotNumber } from "@/lib/slots";

export default function AdminPage() {
  const { user } = useUser();
  const router = useRouter();

  const [games, setGames] = useState<LobbyGame[]>([]);
  const [finance, setFinance] = useState<FinanceOverview | null>(null);
  const [title, setTitle] = useState("");
  const [ticketPrice, setTicketPrice] = useState("100");
  const [payoutPercent, setPayoutPercent] = useState("80");
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
          payoutPercent: Number(payoutPercent),
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
        <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500">
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

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Create Game
        </h2>
        <form onSubmit={createGame} className="space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Game title (optional)"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            value={ticketPrice}
            onChange={(event) => setTicketPrice(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          >
            {["100", "200", "500", "1000"].map((price) => (
              <option key={price} value={price}>
                Rs. {price}
              </option>
            ))}
          </select>
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">
              Winner payout: {payoutPercent}% of the pool (house keeps{" "}
              {100 - Number(payoutPercent || 0)}%)
            </span>
            <input
              type="range"
              min={1}
              max={100}
              value={payoutPercent}
              onChange={(event) => setPayoutPercent(event.target.value)}
              className="w-full"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Create Game Session
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Close & Draw
        </h2>
        {games
          .filter((game) => game.status === "OPEN" && game.soldCount > 0)
          .map((game) => (
            <article
              key={`close-${game.id}`}
              className="rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <p className="font-semibold text-zinc-900">{game.title}</p>
              <p className="text-sm text-zinc-500">
                {game.soldCount} slots sold — close to enable draw
              </p>
              <button
                type="button"
                onClick={() => closeGame(game.id)}
                className="mt-3 w-full rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold"
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
              className="rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <p className="font-semibold text-zinc-900">{game.title}</p>
              <p className="text-sm text-zinc-500">
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
                  className="w-24 rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => runDraw(game.id)}
                  className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Enter Winning Number
                </button>
              </div>
            </article>
          ))}
        {games.filter((game) => game.status === "CLOSED").length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500">
            No closed games awaiting draw. Games auto-close when all 100 slots sell.
          </p>
        ) : null}
      </section>

      {finance ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Financial Overview
          </h2>
          {finance.games.map((game) => (
            <article
              key={game.gameId}
              className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">{game.title}</p>
                  <p className="text-zinc-500">{game.status}</p>
                </div>
                <p className="font-semibold text-emerald-700">
                  Net {formatRs(game.platformRevenue)}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-zinc-600">
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
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-base font-bold text-zinc-900">{value}</p>
    </div>
  );
}
