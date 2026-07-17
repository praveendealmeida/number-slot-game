import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ProgressBar } from "@/components/ProgressBar";
import { LobbyGame } from "@/lib/api-client";
import { formatRs } from "@/lib/format";
import { WINNER_PAYOUT_PERCENT } from "@/lib/payout";
import { TOTAL_SLOTS } from "@/lib/slots";

type GameCardProps = {
  game: LobbyGame;
};

function statusBadge(status: string) {
  const config: Record<string, { bg: string; border: string; text: string }> = {
    OPEN: { bg: "bg-[#22C55E]/15", border: "border-[#22C55E]/30", text: "text-[#22C55E]" },
    CLOSED: { bg: "bg-[#F97316]/15", border: "border-[#F97316]/30", text: "text-[#F97316]" },
    DRAWN: { bg: "bg-[#27272A]", border: "border-[#27272A]", text: "text-[#A1A1AA]" },
  };
  const c = config[status] ?? config.DRAWN;
  return (
    <View className={`rounded-full px-2.5 py-0.5 border ${c.border} ${c.bg}`}>
      <Text className={`text-[10px] font-bold ${c.text}`}>{status}</Text>
    </View>
  );
}

function tierTag(price: number) {
  if (price >= 1000) return { label: "ROYAL", color: "text-[#C4B5FD] border-[#C4B5FD]/25" };
  if (price >= 500) return { label: "HOT", color: "text-[#F97316] border-[#F97316]/25" };
  return { label: "QUICK", color: "text-[#22C55E] border-[#22C55E]/25" };
}

export function GameCard({ game }: GameCardProps) {
  const router = useRouter();
  const potentialPrize = Math.floor(
    (game.ticketPrice * TOTAL_SLOTS * WINNER_PAYOUT_PERCENT) / 100,
  );
  const tier = tierTag(game.ticketPrice);

  return (
    <View className="relative overflow-hidden rounded-[20px] border border-[#27272A] bg-gradient-to-b from-[#1C1C21] to-[#18181B] shadow-lg shadow-black/40">
      {/* Purple radial glow */}
      <View className="absolute -inset-x-[20%] -top-[40%] h-[180px] opacity-45"
        style={{ backgroundColor: "#5B21B6", borderRadius: 999, filter: "blur(60px)" }}
      />

      {/* Header row */}
      <View className="relative flex-row items-center justify-between px-4 pt-3.5">
        <Text className="text-[13px] font-semibold text-[#A1A1AA]">
          <Text className="text-[#FAFAFA]">{game.title}</Text>
        </Text>
        <View className="flex-row items-center gap-2">
          <View className={`rounded-full border px-2.5 py-0.5 bg-gradient-to-br from-[#5B21B6] to-[#4C1D95] ${tier.color}`}>
            <Text className="text-[10px] font-bold tracking-wider text-[#C4B5FD]">{tier.label}</Text>
          </View>
          {statusBadge(game.status)}
        </View>
      </View>

      {/* Prize area */}
      <View className="relative items-center pt-2.5 pb-1 px-4">
        <Text className="text-[10px] font-extrabold uppercase tracking-widest text-[#F97316]">
          Win up to
        </Text>
        <Text className="my-0.5 text-[38px] font-black leading-none text-[#FACC15]"
          style={{ textShadowColor: "rgba(250,204,21,0.28)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 30 }}
        >
          <Text className="text-[0.4em] align-top font-bold text-[#FDE68A]">Rs.</Text>
          {potentialPrize.toLocaleString("en-IN")}
        </Text>
      </View>

      {/* Entry + Progress */}
      <View className="relative flex-row items-center gap-3 px-4 pt-3">
        <View className="rounded-xl border border-[#22C55E]/35 bg-[#22C55E]/10 px-3 py-1.5 items-end">
          <Text className="text-sm font-extrabold text-[#22C55E] tabular-nums">
            {formatRs(game.ticketPrice)}
          </Text>
          <Text className="text-[9px] font-semibold uppercase tracking-wide text-[#22C55E]/80">
            Entry
          </Text>
        </View>
        <View className="flex-1">
          <ProgressBar soldCount={game.soldCount} remainingSlots={game.remainingSlots} />
        </View>
      </View>

      {/* CTA Button */}
      <View className="relative px-4 pb-4 pt-3.5">
        <TouchableOpacity
          onPress={() => router.push(`/games/${game.id}`)}
          activeOpacity={0.8}
          className="w-full py-3 rounded-xl bg-gradient-to-b from-[#F97316] to-[#FACC15] items-center justify-center flex-row shadow-lg shadow-[#F97316]/25"
        >
          <Text className="text-sm font-extrabold text-[#1C1006]">
            {game.status === "OPEN" ? "⚡ Pick Numbers" : "View Game"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}