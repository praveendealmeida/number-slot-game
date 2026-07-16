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
import { WINNER_PAYOUT_PERCENT } from "@/lib/payout";
import { formatSlotNumber, TOTAL_SLOTS } from "@/lib/slots";

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

  // Potential prize if this game sells out completely, at the fixed payout share.
  const potentialPrize = board
    ? Math.floor((board.game.ticketPrice * TOTAL_SLOTS * WINNER_PAYOUT_PERCENT) / 100)
    : 0;
  // What the pool is worth right now, at current sales — the honest current figure.
  const currentPoolPrize = board
    ? Math.floor((board.game.ticketPrice * board.soldCount * WINNER_PAYOUT_PERCENT) / 100)
    : 0;

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
          <section className="relative overflow-hidden rounded-[20px] border border-line bg-gradient-to-b from-card-soft to-card p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute -inset-x-[20%] -top-[40%] h-[220px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(91,33,182,0.45),transparent_70%)]" />

            <div className="relative text-center">
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange">
                Win up to
              </p>
              <p className="num my-0.5 text-[44px] font-black leading-none text-gold [text-shadow:0_0_30px_rgba(250,204,21,0.28)]">
                <span className="mr-0.5 align-top text-[0.4em] font-bold text-gold-soft">
                  Rs.
                </span>
                {potentialPrize.toLocaleString("en-IN")}
              </p>
              <p className="text-[11.5px] text-low">
                if all {TOTAL_SLOTS} slots sell · {WINNER_PAYOUT_PERCENT}% of pool to
                the winner
              </p>
              <p className="num mt-1 text-sm font-semibold text-green">
                Rs. {currentPoolPrize.toLocaleString("en-IN")} guaranteed right now
              </p>
            </div>

            <div className="relative mt-4">
              <ProgressBar
                soldCount={board.soldCount}
                remainingSlots={board.remainingSlots}
              />
            </div>

            {board.game.status !== "OPEN" ? (
              <p className="relative mt-3 rounded-xl border border-orange/30 bg-orange/10 px-3 py-2 text-sm text-orange">
                This game is {board.game.status.toLowerCase()}
                {board.game.winningNumber !== null
                  ? ` — winning number: ${formatSlotNumber(board.game.winningNumber)}`
                  : ""}
                .
              </p>
            ) : (
              <p className="relative mt-3 text-center text-[11.5px] text-low">
                Draw happens once all slots sell or an admin closes the game.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-hi">Select Numbers</h2>
              <span className="num text-xs text-mid">{selected.length} selected</span>
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
              className="w-full rounded-xl bg-gradient-to-b from-orange to-gold px-4 py-3.5 text-sm font-extrabold text-[#1C1006] shadow-[0_8px_24px_rgba(249,115,22,0.25)] transition hover:scale-[1.03] hover:shadow-[0_12px_34px_rgba(250,204,21,0.4)] disabled:cursor-not-allowed disabled:bg-line disabled:bg-none disabled:text-low disabled:shadow-none disabled:hover:scale-100"
            >
              {awaitingRef
                ? "Waiting for payment..."
                : submitting
                  ? "Starting checkout..."
                  : `⚡ Buy ${selected.length || 0} Slot(s) — ${formatRs(totalCost)}`}
            </button>
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
        </>
      ) : (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-mid">
          Loading game board...
        </p>
      )}
    </AppShell>
  );
}
