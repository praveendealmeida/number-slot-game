import { View, Text, TouchableOpacity, Animated } from "react-native";
import { useRef, memo } from "react";
import { Trophy, Users, Clock, ArrowRight } from "lucide-react-native";
import type { LobbyGame } from "@/lib/api-client";
import { useRouter } from "expo-router";

// ── Shared flat-props component ───────────────────────────────────────

type GameCardProps = {
  title: string;
  entryFee: string;
  prize: string;
  players: number;
  maxPlayers: number;
  timeLeft: string;
  onPlay: () => void;
};

function GameCardInner({
  title,
  entryFee,
  prize,
  players,
  maxPlayers,
  timeLeft,
  onPlay,
}: GameCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slotsLeft = maxPlayers - players;
  const progress = players / maxPlayers;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPlay}
        onPressIn={() =>
          Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()
        }
        onPressOut={() =>
          Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start()
        }
        activeOpacity={0.95}
        className="bg-[#1A202C] rounded-2xl overflow-hidden border border-[#1E293B]"
      >
        <View className="h-1 bg-gradient-to-r from-[#8338EC] via-[#F5C542] to-[#FB5607]" />
        <View className="p-4">
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1 mr-2 min-w-0">
              <Text className="text-[#F8F9FA] text-base font-extrabold mb-1" numberOfLines={1}>
                {title}
              </Text>
              <View className="flex-row items-center gap-1">
                <Trophy size={14} color="#F5C542" />
                <Text className="text-[#F5C542] text-sm font-bold">{prize}</Text>
              </View>
            </View>
            <View className="bg-[#8338EC]/10 px-2.5 py-1 rounded-lg border border-[#8338EC]/20 flex-shrink-0">
              <Text className="text-[#9B5DE5] text-xs font-bold">{entryFee}</Text>
            </View>
          </View>

          <View className="mb-3">
            <View className="flex-row justify-between mb-1.5">
              <View className="flex-row items-center gap-1">
                <Users size={12} color="#A0A4B8" />
                <Text className="text-[#A0A4B8] text-xs">{players}/{maxPlayers}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Clock size={12} color="#A0A4B8" />
                <Text className="text-[#A0A4B8] text-xs">{timeLeft}</Text>
              </View>
            </View>
            <View className="h-1.5 bg-[#0B0F14] rounded-full overflow-hidden">
              <View
                className="h-full bg-gradient-to-r from-[#8338EC] to-[#FB5607] rounded-full"
                style={{ width: `${Math.min(progress * 100, 100)}%` }}
              />
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-[#6B7280] text-xs">
              {slotsLeft > 0 ? `${slotsLeft} spots left` : "Full"}
            </Text>
            <View className="flex-row items-center gap-1.5 bg-[#FB5607] px-4 py-2 rounded-xl">
              <Text className="text-[#F8F9FA] text-xs font-extrabold">Play Now</Text>
              <ArrowRight size={13} color="#F8F9FA" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Default export — flat props (used by home screen via `import GameCard from "@/components/GameCard"`) ──
export default memo(GameCardInner);

// ── Named export — lobby adapter (used by lobby.tsx via `import { GameCard } from "@/components/GameCard"`) ──
export function GameCard({ game }: { game: LobbyGame }) {
  const router = useRouter();
  return (
    <GameCardInner
      title={game.title ?? "Untitled"}
      entryFee={`Rs ${game.ticketPrice}`}
      prize={`Rs ${Math.floor((game.ticketPrice ?? 0) * 100 * 0.7)}`}
      players={game.soldCount ?? 0}
      maxPlayers={100}
      timeLeft={game.status === "OPEN" ? "Open" : game.status}
      onPlay={() => router.push(`/games/${game.id}`)}
    />
  );
}