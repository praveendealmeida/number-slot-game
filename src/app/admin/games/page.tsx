"use client";

import { FormEvent, useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, LobbyGame, LobbyResponse } from "@/lib/api-client";
import { formatRs } from "@/lib/format";

const TIER_PRICES = [50, 100, 200, 500, 1000];

export default function AdminGamesPage() {
  const { user } = useUser();
  const router = useRouter();
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadGames = async () => {
    try {
      const res = await apiFetch<LobbyResponse>("/api/games");
      setGames(res.games);
    } catch {
      setError("Failed to load games.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== "ADMIN") { router.replace("/"); return; }
    if (user?.role === "ADMIN") loadGames();
  }, [user, router]);

  async function createGame(event: FormEvent, price: number) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setCreating(true);
    try {
      await apiFetch("/api/games", {
        method: "POST",
        body: JSON.stringify({
          title: `Lucky Number 00-99 (Rs ${price})`,
          ticketPrice: price,
        }),
      });
      setMessage(`Game created at Rs ${price} tier.`);
      await loadGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game.");
    } finally {
      setCreating(false);
    }
  }

  async function seedAllTiers() {
    setError(null);
    setMessage(null);
    setCreating(true);
    let created = 0;
    try {
      for (const price of TIER_PRICES) {
        const existing = games.filter(g => g.status === "OPEN" && g.ticketPrice === price);
        if (existing.length === 0) {
          await apiFetch("/api/games", {
            method: "POST",
            body: JSON.stringify({ title: `Lucky Number 00-99 (Rs ${price})`, ticketPrice: price }),
          });
          created++;
        }
      }
      setMessage(`Seeded ${created} new games across all tiers.`);
      await loadGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed games.");
    } finally {
      setCreating(false);
    }
  }

  const getPrizeEstimate = (price: number) => Math.floor(price * 100 * 0.7);

  if (!user || user.role !== "ADMIN") {
    return <div className="flex min-h-screen items-center justify-center bg-[#0B0F14] text-[#A0A4B8]">Admin access required.</div>;
  }

  const openGames = games.filter(g => g.status === "OPEN");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F8F9FA]">Games</h1>
          <p className="text-sm text-[#6B7280] mt-1">Create and manage slot games across 5 prize tiers</p>
        </div>
        <Link href="/admin/dashboard" className="text-sm text-[#8338EC] hover:underline">← Dashboard</Link>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {TIER_PRICES.map((price) => {
          const existing = openGames.filter(g => g.ticketPrice === price);
          const prize = getPrizeEstimate(price);
          return (
            <div key={price} className="rounded-2xl border border-[#1E293B] bg-[#1A202C] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Rs {price} Tier</p>
              <p className="mt-1 text-[#F5C542] text-lg font-black">Prize Rs {prize.toLocaleString()}</p>
              <p className="text-xs text-[#6B7280] mt-1">70% of collected pool · 100 slots</p>
              <div className="mt-3 space-y-1">
                {existing.length > 0 ? (
                  <p className="text-xs text-[#22C55E]">{existing.length} open game(s)</p>
                ) : (
                  <p className="text-xs text-[#EF4444]">No open game</p>
                )}
              </div>
              <button
                onClick={(e) => createGame(e, price)}
                disabled={creating}
                className="mt-3 w-full rounded-xl bg-[#8338EC] px-3 py-2 text-xs font-extrabold text-[#F8F9FA] transition hover:bg-[#9B5DE5] disabled:opacity-50"
              >
                {existing.length > 0 ? "Create Another" : "Create Game"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Seed All Button */}
      <button
        onClick={seedAllTiers}
        disabled={creating}
        className="mb-6 rounded-xl bg-[#FB5607] px-6 py-3 text-sm font-extrabold text-[#F8F9FA] transition hover:bg-[#FF7B3D] disabled:opacity-50"
      >
        {creating ? "Creating..." : "Seed All Missing Tiers"}
      </button>

      {message && (
        <div className="mb-4 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 px-4 py-3">
          <p className="text-sm text-[#22C55E]">{message}</p>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 px-4 py-3">
          <p className="text-sm text-[#EF4444]">{error}</p>
        </div>
      )}

      {/* Games Table */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#1A202C] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#6B7280]">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#6B7280]">Entry</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#6B7280]">Prize</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#6B7280]">Sold</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#6B7280]">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#6B7280]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id} className="border-b border-[#1E293B] last:border-b-0">
                <td className="px-4 py-3 text-[#F8F9FA]">{game.title}</td>
                <td className="px-4 py-3 text-[#A0A4B8]">Rs {game.ticketPrice}</td>
                <td className="px-4 py-3 text-[#F5C542]">Rs {getPrizeEstimate(game.ticketPrice).toLocaleString()}</td>
                <td className="px-4 py-3 text-[#A0A4B8]">{game.soldCount || 0}/100</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold ${game.status === "OPEN" ? "text-[#22C55E]" : game.status === "CLOSED" ? "text-[#F5C542]" : "text-[#6B7280]"}`}>
                    {game.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/games/${game.id}`} className="text-sm text-[#8338EC] hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[#6B7280]">Loading games...</td></tr>
            )}
            {!loading && games.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[#6B7280]">No games yet. Click a tier to create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}