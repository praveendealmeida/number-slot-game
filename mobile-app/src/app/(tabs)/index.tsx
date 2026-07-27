import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { fetchLatestLotteryResult, LotteryResult, apiFetch, LobbyGame, LobbyResponse } from "@/lib/api-client";
import { formatRs } from "@/lib/format";
import Hero3D from "@/components/Hero3D";
import JackpotCard from "@/components/JackpotCard";
import LotteryResultCard from "@/components/LotteryResultCard";
import GameCard from "@/components/GameCard";
import WinnerTicker from "@/components/WinnerTicker";
import AuthModal from "@/components/AuthModal";
import AnimatedButton from "@/components/AnimatedButton";
import { Skeleton } from "@/components/Skeleton";

export default function HomeScreen() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lotteryResult, setLotteryResult] = useState<LotteryResult | null>(null);
  const [lotteryLoading, setLotteryLoading] = useState(true);
  const [lobbyData, setLobbyData] = useState<LobbyResponse | null>(null);
  const [gamesLoading, setGamesLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [lottery, lobby] = await Promise.all([
      fetchLatestLotteryResult(),
      apiFetch<LobbyResponse>("/api/games").catch(() => null),
    ]);
    setLotteryResult(lottery);
    setLobbyData(lobby);
    setLotteryLoading(false);
    setGamesLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handlePlay = (gameId?: string) => {
    if (!isAuthenticated) {
      setShowAuth(true);
      return;
    }
    if (gameId) {
      router.push(`/games/${gameId}`);
    } else {
      router.push("/game/daily-number");
    }
  };

  const handleAuthSuccess = () => {
    setShowAuth(false);
  };

  const handleLotteryPress = () => {
    if (!isAuthenticated) {
      setShowAuth(true);
      return;
    }
    router.push("/game/daily-number");
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-LK", { day: "numeric", month: "long", year: "numeric" });
  };

  // Get open games sorted by price
  const openGames = lobbyData?.games
    .filter((g) => g.status === "OPEN")
    .sort((a, b) => a.ticketPrice - b.ticketPrice) ?? [];

  return (
    <View className="flex-1 bg-[#0B0F14]">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F5C542"
            colors={["#F5C542"]}
          />
        }
      >
        {/* 1. Hero */}
        <Hero3D />

        {/* 2. Play Now CTA */}
        <View className="px-5 mb-6">
          <AnimatedButton onPress={() => handlePlay()} variant="orange" size="lg" className="w-full">
            {isAuthenticated ? "Play Today's Number" : "Sign in to Play"}
          </AnimatedButton>
        </View>

        {/* 3. Jackpot */}
        <View className="px-5 mb-6">
          <JackpotCard amount="Rs 500,000" timeLeft="04:32:18" />
        </View>

        {/* 4. Lottery Result */}
        <View className="px-5 mb-6">
          {lotteryLoading ? (
            <Skeleton className="h-64 rounded-3xl bg-[#1A202C]" />
          ) : lotteryResult ? (
            <LotteryResultCard
              drawNumber={lotteryResult.drawNumber}
              drawDate={formatDate(lotteryResult.drawDate)}
              ticketNumber={lotteryResult.ticketNumber}
              winningNumber={lotteryResult.winningNumber}
              isAuthenticated={isAuthenticated}
              onPlay={handleLotteryPress}
            />
          ) : null}
        </View>

        {/* 5. Real Game Cards from API */}
        <View className="px-5 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-[#F8F9FA] text-lg font-extrabold">Today's Games</Text>
            <Text className="text-[#8338EC] text-sm font-bold">
              {openGames.length} open
            </Text>
          </View>

          {gamesLoading ? (
            <View className="gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-2xl bg-[#1A202C]" />
              ))}
            </View>
          ) : openGames.length > 0 ? (
            <View className="gap-4">
              {openGames.map((game) => (
                <GameCard
                  key={game.id}
                  title={game.title}
                  entryFee={`Rs ${game.ticketPrice}`}
                  prize={`Rs ${Math.floor(game.ticketPrice * 100 * 0.7).toLocaleString()}`}
                  players={game.soldCount}
                  maxPlayers={100}
                  timeLeft={game.status === "OPEN" ? "Until 7 PM" : game.status}
                  onPlay={() => handlePlay(game.id)}
                />
              ))}
            </View>
          ) : (
            <View className="rounded-2xl border border-[#1E293B] bg-[#1A202C] p-6 items-center">
              <Text className="text-[#6B7280] text-sm text-center">
                No games open right now.{'\n'}New games start at 12 PM daily.
              </Text>
            </View>
          )}
        </View>

        {/* 6. Winners */}
        <View className="px-5 mb-10">
          <WinnerTicker />
        </View>
      </ScrollView>

      <AuthModal
        visible={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={handleAuthSuccess}
      />
    </View>
  );
}