import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Star, ChevronLeft } from "lucide-react-native";
import {
  fetchDailyGame,
  fetchLatestLotteryResult,
  enterDailyGame,
  DailyGameData,
  LotteryResult,
} from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import NumberGrid from "@/components/NumberGrid";
import AnimatedButton from "@/components/AnimatedButton";
import AuthModal from "@/components/AuthModal";
import { Skeleton } from "@/components/Skeleton";

function formatBalance(cents: number): string {
  return `Rs ${(cents / 100).toFixed(0)}`;
}

export default function DailyNumberScreen() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [game, setGame] = useState<DailyGameData | null>(null);
  const [lottery, setLottery] = useState<LotteryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const load = useCallback(async () => {
    const [g, l] = await Promise.all([
      fetchDailyGame().catch(() => null),
      fetchLatestLotteryResult(),
    ]);
    setGame(g);
    setLottery(l);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePlay = async () => {
    if (!isAuthenticated) { setShowAuth(true); return; }
    if (!selected) return;

    setEntering(true);
    try {
      const result = await enterDailyGame(selected);
      Alert.alert("Entry Confirmed", `You picked #${selected} for ${formatBalance(result.ticket.entryFee)}.\nBalance: ${formatBalance(result.balance)}`);
      router.back();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to enter game.");
    } finally {
      setEntering(false);
    }
  };

  const handleAuthSuccess = () => { setShowAuth(false); };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0B0F14]">
        <View className="flex-1 px-5 pt-12">
          <Skeleton className="h-6 w-32 mb-6 rounded-md bg-[#1A202C]" />
          <Skeleton className="h-24 rounded-2xl bg-[#1A202C] mb-6" />
          <Skeleton className="h-96 rounded-3xl bg-[#1A202C]" />
        </View>
      </SafeAreaView>
    );
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-LK", { day: "numeric", month: "long", year: "numeric" });

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F14]">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 rounded-xl bg-[#1A202C] border border-[#1E293B] items-center justify-center mr-3"
          >
            <ChevronLeft size={20} color="#A0A4B8" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-[#F8F9FA] text-xl font-extrabold">🇱🇰 Today's Lucky Number</Text>
            <Text className="text-[#6B7280] text-xs mt-0.5">Pick the last 2 digits and win</Text>
          </View>
        </View>

        {/* Game info bar */}
        {game && (
          <View className="bg-[#1A202C] rounded-2xl p-4 border border-[#1E293B] mb-6">
            <View className="flex-row justify-between">
              <View>
                <Text className="text-[#6B7280] text-xs">Entry Fee</Text>
                <Text className="text-[#F8F9FA] text-sm font-extrabold">{formatBalance(game.entryFee)}</Text>
              </View>
              <View>
                <Text className="text-[#6B7280] text-xs text-right">Prize</Text>
                <Text className="text-[#F5C542] text-sm font-extrabold">{formatBalance(game.prizeAmount)}</Text>
              </View>
              <View>
                <Text className="text-[#6B7280] text-xs text-right">Players</Text>
                <Text className="text-[#F8F9FA] text-sm font-extrabold">{game.currentPlayers}/{game.maxPlayers}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Lottery history */}
        {lottery && (
          <View className="bg-[#1A202C] rounded-2xl p-4 border border-[#1E293B] mb-6">
            <View className="flex-row items-center gap-2 mb-3">
              <Star size={14} color="#F5C542" />
              <Text className="text-[#A0A4B8] text-xs font-bold uppercase tracking-widest">Yesterday's Result</Text>
              <Text className="text-[#6B7280] text-xs">#</Text>
            </View>
            <View className="flex-row justify-center gap-2 mb-2">
              {lottery.winningNumber.replace(/\D/g, "").split("").map((d, i) => (
                <View key={i} className="w-10 h-12 rounded-xl bg-[#F5C542]/15 border border-[#F5C542]/30 items-center justify-center">
                  <Text className="text-[#F5C542] text-lg font-black">{d}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Number selector */}
        <View className="mb-6">
          <Text className="text-[#F8F9FA] text-base font-extrabold mb-4">Pick Your Number</Text>
          <NumberGrid selected={selected} onSelect={setSelected} disabled={[]} />
        </View>

        {/* Selection card */}
        <View className="bg-[#1A202C] rounded-3xl p-5 border border-[#1E293B] mb-8">
          <View className="items-center mb-5">
            <Text className="text-[#6B7280] text-xs mb-1 uppercase tracking-widest">Your Pick</Text>
            {selected ? (
              <View className="flex-row gap-2 mt-2">
                {selected.split("").map((d, i) => (
                  <View key={i} className="w-14 h-16 rounded-xl bg-[#F5C542] items-center justify-center shadow-lg shadow-[#F5C542]/30">
                    <Text className="text-[#0B0F14] text-2xl font-black">{d}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className="flex-row gap-2 mt-2">
                <View className="w-14 h-16 rounded-xl bg-[#0B0F14] border-2 border-dashed border-[#1E293B] items-center justify-center"><Text className="text-[#6B7280] text-2xl">-</Text></View>
                <View className="w-14 h-16 rounded-xl bg-[#0B0F14] border-2 border-dashed border-[#1E293B] items-center justify-center"><Text className="text-[#6B7280] text-2xl">-</Text></View>
              </View>
            )}
          </View>

          <View className="flex-row justify-between px-2 mb-5">
            <View><Text className="text-[#6B7280] text-xs">Entry Fee</Text><Text className="text-[#F8F9FA] text-sm font-extrabold">{game ? formatBalance(game.entryFee) : "—"}</Text></View>
            <View><Text className="text-[#6B7280] text-xs text-right">Possible Prize</Text><Text className="text-[#F5C542] text-sm font-extrabold">{game ? formatBalance(game.prizeAmount) : "—"}</Text></View>
          </View>

          <AnimatedButton onPress={handlePlay} variant="orange" size="lg" className="w-full" disabled={!selected || entering} loading={entering}>
            {isAuthenticated ? (selected ? `Confirm Play — ${game ? formatBalance(game.entryFee) : ""}` : "Pick a number") : "Sign in to Play"}
          </AnimatedButton>
        </View>
      </ScrollView>

      <AuthModal visible={showAuth} onClose={() => setShowAuth(false)} onSuccess={handleAuthSuccess} />
    </SafeAreaView>
  );
}