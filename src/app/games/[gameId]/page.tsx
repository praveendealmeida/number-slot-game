"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProgressBar } from "@/components/ProgressBar";
import { SlotGrid } from "@/components/SlotGrid";
import { useUser } from "@/context/UserContext";
import { GameBoardResponse, apiFetch } from "@/lib/api-client";
import { formatRs } from "@/lib/format";
import { formatSlotNumber } from "@/lib/slots";

export default function GamePage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const { user } = useUser();

  const [board, setBoard] = useState<GameBoardResponse | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadBoard = useCallback(async () => {
    const data = await apiFetch<GameBoardResponse>(`/api/games/${gameId}/tickets`);
    setBoard(data);
  }, [gameId]);

  useEffect(() => {
    loadBoard().catch((err: Error) => setError(err.message));
    const interval = setInterval(() => {
      loadBoard().catch(() => undefined);
    }, 4000);
    return () => clearInterval(interval);
  }, [loadBoard]);

  const soldSlots = board?.soldSlots.map((slot) => slot.slotNumber) ?? [];
  const soldSlotOwners = useMemo(() => {
    const map: Record<number, string> = {};
    board?.soldSlots.forEach((slot) => {
      map[slot.slotNumber] = slot.userId;
    });
    return map;
  }, [board]);

  const ownedByUser =
    board?.soldSlots
      .filter((slot) => slot.userId === user?.id)
      .map((slot) => slot.slotNumber) ?? [];

  const totalCost = board ? selected.length * board.game.ticketPrice : 0;
  const isOpen = board?.game.status === "OPEN";

  function toggleSlot(slotNumber: number) {
    setSelected((current) =>
      current.includes(slotNumber)
        ? current.filter((value) => value !== slotNumber)
        : [...current, slotNumber],
    );
  }

  async function purchaseSelected() {
    if (!selected.length) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await apiFetch<{
        soldCount: number;
        remainingSlots: number;
        totalPaid: number;
        tickets: Array<{ slotNumber: number }>;
      }>(`/api/games/${gameId}/tickets`, {
        method: "POST",
        body: JSON.stringify({ slotNumbers: selected }),
      });

      setMessage(
        `Purchased ${result.tickets.map((ticket) => formatSlotNumber(ticket.slotNumber)).join(", ")} for ${formatRs(result.totalPaid)}.`,
      );
      setSelected([]);
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title={board?.game.title ?? "Loading..."}
      subtitle={board ? `${formatRs(board.game.ticketPrice)} per slot` : undefined}
    >
      {board ? (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-4">
            <ProgressBar
              soldCount={board.soldCount}
              remainingSlots={board.remainingSlots}
            />
            <p className="mt-3 text-sm text-zinc-600">
              Winner takes {board.game.payoutPercent}% of the pool.
            </p>
            {board.game.status !== "OPEN" ? (
              <p className="mt-3 text-sm text-amber-700">
                This game is {board.game.status.toLowerCase()}
                {board.game.winningNumber !== null
                  ? ` — winning number: ${formatSlotNumber(board.game.winningNumber)}`
                  : ""}
                .
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Select Numbers</h2>
              <span className="text-xs text-zinc-500">{selected.length} selected</span>
            </div>
            <SlotGrid
              soldSlots={soldSlots}
              selected={selected}
              ownedByUser={ownedByUser}
              disabled={!isOpen || submitting}
              currentUserId={user?.id ?? null}
              soldSlotOwners={soldSlotOwners}
              onToggle={toggleSlot}
            />
          </section>

          {isOpen ? (
            <button
              type="button"
              disabled={!selected.length || submitting}
              onClick={purchaseSelected}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {submitting
                ? "Processing..."
                : `Buy ${selected.length || 0} Slot(s) — ${formatRs(totalCost)}`}
            </button>
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
        </>
      ) : (
        <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500">Loading game board...</p>
      )}
    </AppShell>
  );
}
