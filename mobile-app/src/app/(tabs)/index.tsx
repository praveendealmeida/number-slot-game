import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { fetchLatestLotteryResult, LotteryResult } from "@/lib/api-client";
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

  const loadLottery = useCallback(async () => {
    const result = await fetchLatestLotteryResult();
    setLotteryResult(result);
    setLotteryLoading(false);
  }, []);

  useEffect(() => {
    loadLottery();
  }, [loadLottery]);

  const handlePlay = () => {
    if (!isAuthenticated) {
      setShowAuth(true);
      return;
    }
    router.push("/lobby");
  };

  const handleAuthSuccess = () => {
    setShowAuth(false);
    router.push("/lobby");
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
    await loadLottery();
    setRefreshing(false);
  };

  // Format the ISO date to readable format
  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-LK", { day: "numeric", month: "long", year: "numeric" });
  };

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
          <AnimatedButton onPress={handlePlay} variant="orange" size="lg" className="w-full">
            {isAuthenticated ? "Play Now" : "Sign in to Play"}
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

        {/* 5. Game Cards */}
        <View className="px-5 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-[#F8F9FA] text-lg font-extrabold">Available Games</Text>
            <Text className="text-[#8338EC] text-sm font-bold">See All</Text>
          </View>

          <View className="gap-4">
            <GameCard
              title="Lucky Number 00-99"
              entryFee="Rs 100"
              prize="Rs 10,000"
              players={67}
              maxPlayers={100}
              timeLeft="2h 15m"
              onPlay={handlePlay}
            />
            <GameCard
              title="Lucky Number 00-99"
              entryFee="Rs 500"
              prize="Rs 50,000"
              players={34}
              maxPlayers={100}
              timeLeft="5h 42m"
              onPlay={handlePlay}
            />
            <GameCard
              title="Lucky Number 00-99"
              entryFee="Rs 1000"
              prize="Rs 100,000"
              players={12}
              maxPlayers={100}
              timeLeft="8h 10m"
              onPlay={handlePlay}
            />
          </View>
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