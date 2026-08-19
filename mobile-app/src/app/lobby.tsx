import { View, Text, ScrollView, Animated, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { GameCard } from "@/components/GameCard";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, LobbyGame, LobbyResponse } from "@/lib/api-client";
import { formatRs } from "@/lib/format";
import { WINNER_PAYOUT_PERCENT } from "@/lib/payout";
import { TICKET_PRICE_TIERS } from "@/lib/pricing";

export default function LobbyScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<LobbyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;
  const cardAnimValues = useMemo(
    () => Array.from({ length: 10 }, () => new Animated.Value(0)),
    [],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlide, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerFade, headerSlide]);

  // Animate cards in sequence
  useEffect(() => {
    if (!data) return;
    const totalCards = data.games.filter((g) => g.status === "OPEN").length;
    const animations = cardAnimValues.slice(0, totalCards).map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: 200 + index * 100,
        useNativeDriver: true,
      }),
    );
    Animated.stagger(80, animations).start();
  }, [data, cardAnimValues]);

  let cardIndex = 0;
  const nextCardAnim = () => {
    const anim = cardAnimValues[cardIndex];
    cardIndex += 1;
    return {
      opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
      transform: [{
        translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
      }],
    };
  };

  // Data fetching — same logic as the web app
  const load = useCallback(async (isRefresh = false) => {
    try {
      const res = await apiFetch<LobbyResponse>("/api/games");
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load games.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 15000);
    return () => clearInterval(interval);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  // Only OPEN games — same filter as web
  const openGamesByPrice = useMemo(() => {
    const map = new Map<number, LobbyGame[]>();
    if (!data) return map;
    for (const game of data.games) {
      if (game.status !== "OPEN") continue;
      const list = map.get(game.ticketPrice) ?? [];
      list.push(game);
      map.set(game.ticketPrice, list);
    }
    return map;
  }, [data]);

  // Live combined prize pool — exact same formula as web
  const liveJackpot = useMemo(() => {
    if (!data) return 0;
    const collected = data.games
      .filter((g) => g.status === "OPEN")
      .reduce((sum, g) => sum + g.soldCount * g.ticketPrice, 0);
    return Math.floor((collected * WINNER_PAYOUT_PERCENT) / 100);
  }, [data]);

  const activeGameCount = data?.games.filter((g) => g.status === "OPEN").length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-[#09090B]">
      {/* Header with user bar */}
      <Animated.View
        style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}
        className="px-4 pt-2 pb-1"
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[#FAFAFA] text-2xl font-extrabold tracking-tight">
              Lucky <Text className="text-[#FACC15]">Lanka</Text>
            </Text>
            <Text className="text-[#71717A] text-xs mt-0.5">
              Pick your lucky numbers
            </Text>
          </View>
          {/* User avatar or sign-in */}
          {user ? (
            <View className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5B21B6] to-[#4C1D95] items-center justify-center border-2 border-[#FACC15]/50">
              <Text className="text-[#FAFAFA] text-sm font-bold">
                {(user.name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
              </Text>
            </View>
          ) : (
            <View
              className="rounded-xl bg-gradient-to-b from-[#F97316] to-[#FACC15] px-3 py-1.5"
            >
              <Text
                className="text-[#1C1006] text-xs font-extrabold"
                onPress={() => router.push("/")}
              >
                Sign In
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#C4B5FD"
            colors={["#5B21B6", "#C4B5FD"]}
            progressBackgroundColor="#18181B"
          />
        }
      >
        {/* Live Prize Pool Banner */}
        <Animated.View
          style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}
          className="mt-1 -mx-4 px-4 py-3 border-b border-[#FACC15]/20 bg-gradient-to-b from-[#2E1065] via-[#5B21B6] to-[#4C1D95]"
        >
          <View className="flex-row items-center justify-between mb-0.5">
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-[#22C55E]" style={{
                shadowColor: "#22C55E",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.55,
                shadowRadius: 4,
              }} />
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-[#C4B5FD]">
                Live Combined Prize Pool
              </Text>
            </View>
            <Text className="text-[11px] text-[#C4B5FD]/80">
              {activeGameCount} active {activeGameCount === 1 ? "game" : "games"}
            </Text>
          </View>
          <Text className="text-[32px] font-black leading-none text-[#FACC15] tabular-nums"
            style={{
              textShadowColor: "rgba(250,204,21,0.35)",
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 24,
            }}
          >
            <Text className="text-[0.42em] font-bold text-[#FDE68A]">Rs.</Text>
            {liveJackpot.toLocaleString("en-IN")}
          </Text>
        </Animated.View>

        {/* Loading state */}
        {loading ? (
          <View className="mt-4 rounded-2xl border border-[#27272A] bg-[#18181B] p-5">
            <Text className="text-sm text-[#A1A1AA] text-center">
              Loading games...
            </Text>
          </View>
        ) : null}

        {/* Error state */}
        {error ? (
          <View className="mt-4 rounded-2xl border border-[#F97316]/30 bg-[#F97316]/10 p-4">
            <Text className="text-sm text-[#F97316] text-center">{error}</Text>
          </View>
        ) : null}

        {/* Game tiers — same logic as web */}
        {!loading && !error
          ? TICKET_PRICE_TIERS.map((price) => {
              const games = openGamesByPrice.get(price) ?? [];
              if (games.length === 0) return null;
              return (
                <View key={price} className="mt-4">
                  {/* Tier header */}
                  <View className="flex-row items-center gap-2 mb-3">
                    <View className="w-3 h-[2px] rounded-full bg-[#F97316]" />
                    <Text className="text-[13px] font-bold uppercase tracking-wide text-[#A1A1AA]">
                      {formatRs(price)} Games
                    </Text>
                    <Text className="ml-auto text-xs text-[#71717A]">
                      {games.length} active
                    </Text>
                  </View>
                  {/* Cards */}
                  {games.map((game) => {
                    const cardStyle = nextCardAnim();
                    return (
                      <Animated.View
                        key={game.id}
                        style={cardStyle}
                        className="mb-3"
                      >
                        <GameCard game={game} />
                      </Animated.View>
                    );
                  })}
                </View>
              );
            })
          : null}

        {/* Empty state */}
        {!loading && !error && openGamesByPrice.size === 0 ? (
          <View className="mt-6 rounded-2xl border border-[#27272A] bg-[#18181B] p-6">
            <Text className="text-sm text-[#A1A1AA] text-center leading-6">
              No games open right now — new games roll out automatically every day.
            </Text>
          </View>
        ) : null}

        {/* Bottom spacer for safe area */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}