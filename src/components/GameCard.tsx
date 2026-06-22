import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { formatRs } from "@/lib/format";
import { LobbyGame } from "@/lib/api-client";

type GameCardProps = {
  game: LobbyGame;
};

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    OPEN: "bg-emerald-100 text-emerald-800",
    CLOSED: "bg-amber-100 text-amber-800",
    DRAWN: "bg-zinc-200 text-zinc-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status] ?? "bg-zinc-100"}`}
    >
      {status}
    </span>
  );
}

export function GameCard({ game }: GameCardProps) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">{game.title}</h3>
          <p className="text-sm text-zinc-500">{formatRs(game.ticketPrice)} per slot</p>
        </div>
        {statusBadge(game.status)}
      </div>

      <ProgressBar soldCount={game.soldCount} remainingSlots={game.remainingSlots} />

      <Link
        href={`/games/${game.id}`}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        {game.status === "OPEN" ? "Pick Numbers" : "View Game"}
      </Link>
    </article>
  );
}
