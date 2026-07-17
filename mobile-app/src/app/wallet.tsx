import { View, Text, ScrollView, SafeAreaView, Animated, RefreshControl } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { ProfileResponse, apiFetch } from "@/lib/api-client";
import { formatRs } from "@/lib/format";
import { formatSlotNumber } from "@/lib/slots";

type TicketItem = ProfileResponse["tickets"][number];

function outcomeLabel(outcome: string) {
  if (outcome === "WON") return "🏆 Won";
  if (outcome === "LOST") return "Lost";
  return "Pending";
}

function outcomeColors(outcome: string) {
  if (outcome === "WON") return { bg: "bg-[#FACC15]/10", border: "border-[#FACC15]/40", text: "text-[#FACC15]" };
  if (outcome === "LOST") return { bg: "bg-[#27272A]/40", border: "border-[#27272A]", text: "text-[#71717A]" };
  return { bg: "bg-[#F97316]/10", border: "border-[#F97316]/30", text: "text-[#F97316]" };
}

export default function WalletScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const cardAnims = useRef(Array.from({ length: 4 }, () => new Animated.Value(0))).current;
  const listFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (!data) return;
    const anims = cardAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: 200 + i * 100,
        useNativeDriver: true,
      }),
    );
    Animated.stagger(80, anims).start();

    Animated.timing(listFade, {
      toValue: 1,
      duration: 500,
      delay: 600,
      useNativeDriver: true,
    }).start();
  }, [data, cardAnims, listFade]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!user) return;
    try {
      const res = await apiFetch<ProfileResponse>("/api/me/tickets");
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallet data.");
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // Not authenticated state
  if (!authLoading && !isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-[#09090B]">
        <View className="flex-1 items-center justify-center px-6">
          <Animated.View
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            className="items-center"
          >
            <View className="w-20 h-20 rounded-full bg-gradient-to-b from-[#5B21B6] to-[#4C1D95] items-center justify-center mb-6 border-2 border-[#C4B5FD]/30 shadow-lg shadow-[#5B21B6]/30">
              <Text className="text-3xl">👛</Text>
            </View>
            <Text className="text-[#FAFAFA] text-2xl font-extrabold text-center">Wallet</Text>
            <Text className="text-[#A1A1AA] text-sm mt-2 text-center leading-6">
              Sign in to view your tickets,{'\n'}spending, and winnings.
            </Text>
            <View
              className="mt-6 rounded-xl bg-gradient-to-b from-[#F97316] to-[#FACC15] px-6 py-3"
            >
              <Text
                className="text-[#1C1006] text-sm font-extrabold"
                onPress={() => router.push("/")}
              >
                Sign In
              </Text>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#09090B]">
      {/* Header */}
      <Animated.View
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        className="px-4 pt-2 pb-1"
      >
        <Text className="text-[#FAFAFA] text-2xl font-extrabold tracking-tight">
          My <Text className="text-[#FACC15]">Wallet</Text>
        </Text>
        <Text className="text-[#71717A] text-xs mt-0.5">
          Purchased tickets and win/loss history
        </Text>
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
        {/* User Profile Card */}
        {user ? (
          <Animated.View
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            className="flex-row items-center gap-4 rounded-2xl border border-[#27272A] bg-gradient-to-b from-[#1C1C21] to-[#18181B] p-4 shadow-lg shadow-black/30"
          >
            <View className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5B21B6] to-[#4C1D95] items-center justify-center border-2 border-[#FACC15]/50 shadow-lg shadow-[#5B21B6]/30">
              <Text className="text-[#FAFAFA] text-xl font-bold">
                {(user.name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-lg font-bold text-[#FAFAFA]" numberOfLines={1}>
                {user.name ?? user.email}
              </Text>
              <Text className="text-xs text-[#71717A]" numberOfLines={1}>
                {user.email}
              </Text>
              {user.role === "ADMIN" ? (
                <View className="mt-1 self-start rounded-full border border-[#FACC15]/40 bg-[#FACC15]/10 px-2 py-0.5">
                  <Text className="text-[10px] font-bold tracking-wide text-[#FACC15]">ADMIN</Text>
                </View>
              ) : (
                <View className="mt-1 self-start rounded-full border border-[#C4B5FD]/30 bg-[#5B21B6]/15 px-2 py-0.5">
                  <Text className="text-[10px] font-bold tracking-wide text-[#C4B5FD]">PLAYER</Text>
                </View>
              )}
            </View>
          </Animated.View>
        ) : null}

        {/* Error state */}
        {error ? (
          <View className="mt-4 rounded-2xl border border-[#F97316]/30 bg-[#F97316]/10 p-4">
            <Text className="text-sm text-[#F97316] text-center">{error}</Text>
          </View>
        ) : null}

        {/* Stats Cards — same data as web Profile */}
        {data ? (
          <>
            <View className="mt-4 flex-row flex-wrap justify-between">
              <AnimatedCard
                anim={cardAnims[0]}
                label="Tickets"
                value={String(data.summary.totalTickets)}
                color="text-[#C4B5FD]"
                icon="🎫"
              />
              <AnimatedCard
                anim={cardAnims[1]}
                label="Total Spent"
                value={formatRs(data.summary.totalSpent)}
                color="text-[#22C55E]"
                icon="💸"
              />
              <AnimatedCard
                anim={cardAnims[2]}
                label="Wins"
                value={String(data.summary.wins)}
                color="text-[#FACC15]"
                icon="🏆"
              />
              <AnimatedCard
                anim={cardAnims[3]}
                label="Winnings"
                value={formatRs(data.summary.totalWinnings)}
                color="text-[#FACC15]"
                icon="💰"
              />
            </View>

            {/* Net P&L bar */}
            <Animated.View
              style={{ opacity: cardAnims[3] }}
              className="mt-3 rounded-2xl border border-[#27272A] bg-gradient-to-r from-[#18181B] to-[#1C1C21] p-4"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold uppercase tracking-wide text-[#A1A1AA]">
                  Net Result
                </Text>
                {(() => {
                  const net = data.summary.totalWinnings - data.summary.totalSpent;
                  const isProfit = net > 0;
                  return (
                    <View className="flex-row items-center gap-1.5">
                      <Text className={`text-lg font-black tabular-nums ${isProfit ? "text-[#22C55E]" : "text-[#F97316]"}`}>
                        {isProfit ? "+" : ""}
                        {formatRs(net)}
                      </Text>
                      <Text className="text-base">{isProfit ? "📈" : "📉"}</Text>
                    </View>
                  );
                })()}
              </View>
              <View className="mt-2 h-1.5 rounded-full bg-[#27272A] overflow-hidden">
                {(() => {
                  const total = data.summary.totalSpent + data.summary.totalWinnings;
                  const winRatio = total > 0 ? data.summary.totalWinnings / total : 0;
                  return (
                    <View
                      className="h-full rounded-full bg-gradient-to-r from-[#F97316] to-[#22C55E]"
                      style={{ width: `${Math.round(winRatio * 100)}%` }}
                    />
                  );
                })()}
              </View>
              <Text className="text-[10px] text-[#71717A] mt-1.5 text-right tabular-nums">
                {data.summary.wins}W / {data.summary.losses}L ({data.summary.pending} pending)
              </Text>
            </Animated.View>

            {/* Ticket History */}
            <Animated.View style={{ opacity: listFade }} className="mt-5">
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-3 h-[2px] rounded-full bg-[#F97316]" />
                <Text className="text-[13px] font-bold uppercase tracking-wide text-[#A1A1AA]">
                  My Purchased Tickets
                </Text>
              </View>

              {data.tickets.length === 0 ? (
                <View className="rounded-2xl border border-[#27272A] bg-[#18181B] p-6">
                  <Text className="text-sm text-[#A1A1AA] text-center leading-6">
                    No tickets yet.{'\n'}Visit the lobby to buy your first slot.
                  </Text>
                </View>
              ) : null}

              {data.tickets.map((ticket, index) => (
                <TicketCard key={ticket.id} ticket={ticket} index={index} />
              ))}
            </Animated.View>
          </>
        ) : (
          <View className="mt-6 rounded-2xl border border-[#27272A] bg-[#18181B] p-6">
            <Text className="text-sm text-[#A1A1AA] text-center">Loading wallet...</Text>
          </View>
        )}

        {/* Bottom spacer */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

// Animated stat card component
function AnimatedCard({
  anim,
  label,
  value,
  color,
  icon,
}: {
  anim: Animated.Value;
  label: string;
  value: string;
  color: string;
  icon: string;
}) {
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
      }}
      className="w-[48%] mb-3 rounded-2xl border border-[#27272A] bg-[#18181B] p-4"
    >
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="text-[10.5px] font-semibold uppercase tracking-wide text-[#71717A]">
          {label}
        </Text>
        <Text className="text-base">{icon}</Text>
      </View>
      <Text className={`text-lg font-black tabular-nums ${color}`}>{value}</Text>
    </Animated.View>
  );
}

// Ticket card component
function TicketCard({ ticket, index }: { ticket: TicketItem; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;
  const router = useRouter();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: 700 + index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay: 700 + index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const colors = outcomeColors(ticket.outcome);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
      className="mb-3 rounded-2xl border border-[#27272A] bg-[#18181B] p-4"
      key={ticket.id}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-lg font-black text-[#FAFAFA] tabular-nums">
            #{ticket.slotLabel}
          </Text>
          <Text className="text-sm text-[#A1A1AA]">{ticket.game.title}</Text>
          <Text
            className="text-xs font-semibold text-[#C4B5FD] mt-0.5"
            onPress={() => router.push(`/games/${ticket.game.id}`)}
          >
            View game
          </Text>
        </View>
        <View className={`rounded-full px-2.5 py-1 border ${colors.bg} ${colors.border}`}>
          <Text className={`text-xs font-bold ${colors.text}`}>{outcomeLabel(ticket.outcome)}</Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-sm text-[#A1A1AA] tabular-nums">Paid {formatRs(ticket.pricePaid)}</Text>
        {ticket.isWinner ? (
          <Text
            className="font-extrabold text-[#FACC15] tabular-nums"
            style={{
              textShadowColor: "rgba(250,204,21,0.3)",
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 12,
            }}
          >
            Won {formatRs(ticket.winAmount)}
          </Text>
        ) : null}
        {ticket.game.status === "DRAWN" && ticket.game.winningNumber !== null ? (
          <Text className="text-sm text-[#71717A] tabular-nums">
            Draw: {formatSlotNumber(ticket.game.winningNumber)}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}