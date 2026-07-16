import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { LobbyGame } from "@/lib/api-client";
import { formatRs } from "@/lib/format";
import { WINNER_PAYOUT_PERCENT } from "@/lib/payout";
import { TOTAL_SLOTS } from "@/lib/slots";

type GameCardProps = {
  game: LobbyGame;
};

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    OPEN: "bg-green/15 text-green border border-green/30",
    CLOSED: "bg-orange/15 text-orange border border-orange/30",
    DRAWN: "bg-line text-mid border border-line",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold ${styles[status] ?? "bg-line text-mid"}`}
    >
      {status}
    </span>
  );
}

function tierTag(ticketPrice: number) {
  if (ticketPrice >= 1000) return "ROYAL";
  if (ticketPrice >= 500) return "HOT";
  return "QUICK";
}

export function GameCard({ game }: GameCardProps) {
  // Potential prize if this game sells out — winner's fixed 70% share of the
  // full 100-slot pool. Actual payout is calculated on the real pool at draw time.
  const potentialPrize = Math.floor(
    (game.ticketPrice * TOTAL_SLOTS * WINNER_PAYOUT_PERCENT) / 100,
  );

  return (
    <article className="relative overflow-hidden rounded-[20px] border border-line bg-gradient-to-b from-card-soft to-card shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute -inset-x-[20%] -top-[40%] h-[220px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(91,33,182,0.45),transparent_70%)]" />

      <div className="relative flex items-center justify-between gap-3 px-4 pt-3.5">
        <p className="text-[13px] font-semibold text-mid">
          <span className="text-hi">{game.title}</span>
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-royal-tint/25 bg-gradient-to-br from-royal to-royal-soft px-2.5 py-1 text-[10px] font-bold tracking-wider text-royal-tint">
            {tierTag(game.ticketPrice)}
          </span>
          {statusBadge(game.status)}
        </div>
      </div>

      <div className="relative px-4 pb-1 pt-2.5 text-center">
        <p className="text-xs font-extrabold uppercase tracking-widest text-orange">
          Win up to
        </p>
        <p className="num my-0.5 text-[42px] font-black leading-none text-gold [text-shadow:0_0_30px_rgba(250,204,21,0.28)]">
          <span className="mr-0.5 align-top text-[0.4em] font-bold text-gold-soft">
            Rs.
          </span>
          {potentialPrize.toLocaleString("en-IN")}
        </p>
      </div>

      <div className="relative flex items-center justify-between gap-3 px-4 pt-3">
        <div className="rounded-xl border border-green/35 bg-green/10 px-3 py-1.5 text-right">
          <p className="num text-sm font-extrabold text-green">
            {formatRs(game.ticketPrice)}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-green/80">
            Entry
          </p>
        </div>
        <div className="flex-1">
          <ProgressBar soldCount={game.soldCount} remainingSlots={game.remainingSlots} />
        </div>
      </div>

      <div className="relative px-4 pb-4 pt-3.5">
        <Link
          href={`/games/${game.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-orange to-gold px-4 py-3 text-sm font-extrabold text-[#1C1006] shadow-[0_8px_24px_rgba(249,115,22,0.25)] transition hover:scale-[1.03] hover:shadow-[0_12px_34px_rgba(250,204,21,0.4)]"
        >
          {game.status === "OPEN" ? "⚡ Pick Numbers" : "View Game"}
        </Link>
      </div>
    </article>
  );
}
