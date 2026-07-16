"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProgressBar } from "@/components/ProgressBar";
import { SlotGrid } from "@/components/SlotGrid";
import { useUser } from "@/context/UserContext";
import {
  GameBoardResponse,
  PaymentStatusResponse,
  PurchaseInitResponse,
  apiFetch,
} from "@/lib/api-client";
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
  // Order id we're waiting on while the buyer completes hosted checkout.
  const [awaitingRef, setAwaitingRef] = useState<string | null>(null);
  const pollDeadline = useRef<number>(0);

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

  // Poll for payment confirmation while awaiting checkout.
  useEffect(() => {
    if (!awaitingRef) {
      return;
    }
    pollDeadline.current = Date.now() + 10 * 60 * 1000; // give up after 10 min

    const poll = async () => {
      if (Date.now() > pollDeadline.current) {
        setAwaitingRef(null);
        setMessage(null);
        setError("Still waiting on payment. Refresh this page once you've paid.");
        return;
      }
      try {
        const res = await apiFetch<PaymentStatusResponse>(
          `/api/payments/status?ref=${encodeURIComponent(awaitingRef)}`,
        );
        if (res.status === "paid") {
          setAwaitingRef(null);
          setMessage("Payment confirmed — your slots are locked in. Good luck!");
          setError(null);
          await loadBoard();
        } else if (res.status === "expired" || res.status === "not_found") {
          setAwaitingRef(null);
          setMessage(null);
          setError("Payment wasn't completed and the slots were released.");
          await loadBoard();
        }
      } catch {
        // transient — keep polling until the deadline
      }
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [awaitingRef, loadBoard]);

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
  const busy = submitting || awaitingRef !== null;

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
    if (!user) {
      setError("Please sign in before buying slots.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await apiFetch<PurchaseInitResponse>(
        `/api/games/${gameId}/tickets`,
        {
          method: "POST",
          body: JSON.stringify({ slotNumbers: selected }),
        },
      );

      // Open the hosted checkout in a new tab; this page polls for confirmation.
      window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
      setAwaitingRef(result.orderId);
      setSelected([]);
      setMessage(
        `Complete the ${result.currency} ${result.amount.toFixed(2)} payment in the new tab. This page updates automatically once it's confirmed.`,
      );
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
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
              disabled={!isOpen || busy}
              currentUserId={user?.id ?? null}
              soldSlotOwners={soldSlotOwners}
              onToggle={toggleSlot}
            />
          </section>

          {isOpen ? (
            <button
              type="button"
              disabled={!selected.length || busy}
              onClick={purchaseSelected}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {awaitingRef
                ? "Waiting for payment..."
                : submitting
                  ? "Starting checkout..."
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
