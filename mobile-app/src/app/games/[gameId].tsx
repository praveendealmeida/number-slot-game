import { View, Text, ScrollView, TouchableOpacity, Animated, Dimensions, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import ConfettiCannon from "react-native-confetti-cannon";
import { ProgressBar } from "@/components/ProgressBar";
import { SlotGrid } from "@/components/SlotGrid";
import { useAuth } from "@/context/AuthContext";
import {
  GameBoardResponse,
  PurchaseResponse,
  apiFetch,
} from "@/lib/api-client";
import { formatRs } from "@/lib/format";
import { WINNER_PAYOUT_PERCENT } from "@/lib/payout";
import { formatSlotNumber, TOTAL_SLOTS } from "@/lib/slots";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_HORIZONTAL_PADDING = 16;
const GRID_GAP = 4;

// Premium casino design tokens
const COLORS = {
  bg: "#0B0B0F",
  card: "rgba(18, 18, 26, 0.85)",
  cardBorder: "rgba(255, 215, 0, 0.12)",
  gold: "#FFD700",
  goldLight: "#FFF3B0",
  goldDark: "#B8960F",
  purple: "#7C3AED",
  purpleLight: "#A78BFA",
  purpleDark: "#5B21B6",
  glassBg: "rgba(255, 255, 255, 0.04)",
  glassBorder: "rgba(255, 215, 0, 0.08)",
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.4)",
  green: "#10B981",
  orange: "#F59E0B",
};

export default function GameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [board, setBoard] = useState<GameBoardResponse | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Premium animation refs
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;
  const prizeScale = useRef(new Animated.Value(0.5)).current;
  const prizeGlow = useRef(new Animated.Value(0)).current;
  const gridFade = useRef(new Animated.Value(0)).current;
  const ctaSlide = useRef(new Animated.Value(50)).current;
  const ctaFade = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;
  const goldShimmer = useRef(new Animated.Value(0)).current;

  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    // Gold shimmer loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(goldShimmer, { toValue: 1, duration: 2500, useNativeDriver: false }),
        Animated.timing(goldShimmer, { toValue: 0, duration: 2500, useNativeDriver: false }),
      ]),
    ).start();

    // CTA pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, { toValue: 1.03, duration: 1200, useNativeDriver: true }),
        Animated.timing(ctaPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    ).start();
  }, [headerFade, headerSlide, goldShimmer, ctaPulse]);

  // Prize animation when board loads
  useEffect(() => {
    if (!board) return;
    Animated.sequence([
      Animated.timing(prizeScale, { toValue: 1.1, duration: 400, useNativeDriver: true }),
      Animated.spring(prizeScale, { toValue: 1, damping: 8, stiffness: 120, useNativeDriver: true }),
      Animated.timing(prizeGlow, { toValue: 1, duration: 600, useNativeDriver: false }),
    ]).start();

    Animated.sequence([
      Animated.timing(gridFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(ctaFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(ctaSlide, { toValue: 0, damping: 12, stiffness: 100, useNativeDriver: true }),
      ]),
    ]).start();
  }, [board, prizeScale, prizeGlow, gridFade, ctaFade, ctaSlide]);

  // Check for win condition to trigger confetti
  useEffect(() => {
    if (board?.game.status === "DRAWN" && board.game.winningNumber !== null) {
      const userOwnedTicket = board.soldSlots.find(
        (s) => s.userId === user?.id && s.slotNumber === board.game.winningNumber,
      );
      if (userOwnedTicket) {
        setShowConfetti(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [board, user]);

  // Data fetching
  const loadBoard = useCallback(async () => {
    const data = await apiFetch<GameBoardResponse>(`/api/games/${gameId}/tickets`);
    setBoard(data);
  }, [gameId]);

  useEffect(() => {
    loadBoard().catch((err: Error) => setError(err.message));
    const interval = setInterval(() => loadBoard().catch(() => undefined), 4000);
    return () => clearInterval(interval);
  }, [loadBoard]);

  // Derived state
  const soldSlots = board?.soldSlots.map((s) => s.slotNumber) ?? [];
  const soldSlotOwners = useMemo(() => {
    const map: Record<number, string> = {};
    board?.soldSlots.forEach((s) => { map[s.slotNumber] = s.userId; });
    return map;
  }, [board]);

  const ownedByUser = board?.soldSlots
    .filter((s) => s.userId === user?.id)
    .map((s) => s.slotNumber) ?? [];

  const totalCost = board ? selected.length * board.game.ticketPrice : 0;
  const isOpen = board?.game.status === "OPEN";
  const busy = submitting;

  const potentialPrize = board
    ? Math.floor((board.game.ticketPrice * TOTAL_SLOTS * WINNER_PAYOUT_PERCENT) / 100)
    : 0;
  const currentPoolPrize = board
    ? Math.floor((board.game.ticketPrice * board.soldCount * WINNER_PAYOUT_PERCENT) / 100)
    : 0;

  const shimmerInterpolation = goldShimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255, 215, 0, 0.3)", "rgba(255, 215, 0, 0.6)"],
  });

  function toggleSlot(slotNumber: number) {
    Haptics.impactAsync(
      selected.includes(slotNumber)
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Heavy,
    );
    setSelected((c) =>
      c.includes(slotNumber) ? c.filter((v) => v !== slotNumber) : [...c, slotNumber],
    );
  }

  async function purchaseSelected() {
    if (!selected.length) return;
    if (!user) { setError("Please sign in before buying slots."); return; }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await apiFetch<PurchaseResponse>(`/api/games/${gameId}/tickets`, {
        method: "POST",
        body: JSON.stringify({ slotNumbers: selected }),
      });
      setSelected([]);
      setMessage(
        `Paid ${formatRs(result.amountLkr)} from your wallet — your slots are locked in. Good luck!`,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete the purchase.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
          autoStart
          fadeOut
          colors={["#FFD700", "#7C3AED", "#FF6B6B", "#10B981", "#F59E0B", "#FFFFFF"]}
        />
      )}

      <SafeAreaView style={{ flex: 1 }}>
        {/* Gold accent line at top */}
        <View style={{ height: 2, backgroundColor: COLORS.gold, opacity: 0.6 }} />

        {/* Premium Header */}
        <Animated.View
          style={{
            opacity: headerFade,
            transform: [{ translateY: headerSlide }],
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              borderWidth: 1,
              borderColor: "rgba(255, 215, 0, 0.15)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Text style={{ color: COLORS.gold, fontSize: 18, fontWeight: "700" }}>←</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 }}>
              {board?.game.title ?? "Loading..."}
            </Text>
            {board && (
              <Text style={{ color: COLORS.gold, fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                {formatRs(board.game.ticketPrice)} per slot
              </Text>
            )}
          </View>

          {/* Gold chip decoration */}
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: COLORS.gold,
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.6,
          }}>
            <Text style={{ color: COLORS.gold, fontSize: 10, fontWeight: "900" }}>$</Text>
          </View>
        </Animated.View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {board ? (
            <>
              {/* === PRIZE BANNER (Glassmorphism) === */}
              <Animated.View
                style={{
                  opacity: headerFade,
                  transform: [{ translateY: headerSlide }],
                }}
              >
                <View style={{
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: COLORS.glassBorder,
                  backgroundColor: COLORS.glassBg,
                  padding: 20,
                  alignItems: "center",
                  overflow: "hidden",
                }}>
                  {/* Purple glow */}
                  <View style={{
                    position: "absolute",
                    top: -60,
                    left: -40,
                    right: -40,
                    height: 160,
                    backgroundColor: COLORS.purple,
                    opacity: 0.12,
                    borderRadius: 999,
                  }} />

                  <Text style={{
                    fontSize: 11,
                    fontWeight: "800",
                    letterSpacing: 2.5,
                    color: COLORS.gold,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}>
                    ⭐ Jackpot Prize
                  </Text>

                  <Animated.Text
                    style={{
                      fontSize: 48,
                      fontWeight: "900",
                      color: COLORS.gold,
                      letterSpacing: -1,
                      transform: [{ scale: prizeScale }],
                      textShadowColor: "rgba(255, 215, 0, 0.3)",
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 40,
                      marginVertical: 4,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: "700", color: COLORS.goldLight }}>Rs.</Text>
                    {potentialPrize.toLocaleString("en-IN")}
                  </Animated.Text>

                  <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 2 }}>
                    if all {TOTAL_SLOTS} slots sell
                  </Text>

                  {/* Guaranteed prize pill */}
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    borderWidth: 1,
                    borderColor: "rgba(16, 185, 129, 0.25)",
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    marginTop: 6,
                  }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green, marginRight: 6 }} />
                    <Text style={{ color: COLORS.green, fontSize: 13, fontWeight: "700" }}>
                      Rs. {currentPoolPrize.toLocaleString("en-IN")} guaranteed right now
                    </Text>
                  </View>

                  {/* Progress */}
                  <View style={{ width: "100%", marginTop: 16 }}>
                    <ProgressBar soldCount={board.soldCount} remainingSlots={board.remainingSlots} />
                  </View>

                  {/* Status message */}
                  {board.game.status !== "OPEN" ? (
                    <View style={{
                      width: "100%",
                      marginTop: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "rgba(245, 158, 11, 0.3)",
                      backgroundColor: "rgba(245, 158, 11, 0.1)",
                      padding: 10,
                    }}>
                      <Text style={{ color: COLORS.orange, fontSize: 13, textAlign: "center", fontWeight: "600" }}>
                        This game is {board.game.status.toLowerCase()}
                        {board.game.winningNumber !== null
                          ? ` — winning number: ${formatSlotNumber(board.game.winningNumber)}`
                          : ""}.
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 12, textAlign: "center" }}>
                      Draw happens once all slots sell or an admin closes the game
                    </Text>
                  )}
                </View>
              </Animated.View>

              {/* === SLOT GRID SECTION (Glassmorphism) === */}
              <Animated.View
                style={{
                  opacity: gridFade,
                  marginTop: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: COLORS.glassBorder,
                  backgroundColor: COLORS.card,
                  padding: 12,
                }}
              >
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  paddingHorizontal: 4,
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.gold }} />
                    <Text style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: "700" }}>
                      Select Numbers
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: selected.length > 0 ? "rgba(255, 215, 0, 0.12)" : "transparent",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}>
                    <Text style={{
                      color: selected.length > 0 ? COLORS.gold : COLORS.textMuted,
                      fontSize: 13,
                      fontWeight: selected.length > 0 ? "800" : "500",
                    }}>
                      {selected.length} selected
                    </Text>
                  </View>
                </View>
                <SlotGrid
                  soldSlots={soldSlots}
                  selected={selected}
                  ownedByUser={ownedByUser}
                  disabled={!isOpen || busy}
                  currentUserId={user?.id ?? null}
                  soldSlotOwners={soldSlotOwners}
                  onToggle={toggleSlot}
                />
              </Animated.View>

              {/* === PURCHASE CTA (Premium) === */}
              {isOpen ? (
                <Animated.View
                  style={{
                    opacity: ctaFade,
                    transform: [{ translateY: ctaSlide }],
                    marginTop: 16,
                    marginBottom: 8,
                  }}
                >
                  <TouchableOpacity
                    onPress={purchaseSelected}
                    disabled={!selected.length || busy}
                    activeOpacity={0.85}
                  >
                    <Animated.View
                      style={{
                        transform: [{ scale: !selected.length || busy ? 1 : ctaPulse }],
                        borderRadius: 16,
                        overflow: "hidden",
                      }}
                    >
                      {/* Gold gradient background */}
                      <LinearGradient
                        colors={
                          !selected.length || busy
                            ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                            : ["#FFD700", "#E6B800", "#B8960F"]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          paddingVertical: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: !selected.length || busy
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(255, 215, 0, 0.4)",
                        }}
                      >
                        {/* Shimmer overlay on active */}
                        {selected.length > 0 && !busy && (
                          <Animated.View
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: shimmerInterpolation as any,
                              opacity: 0.3,
                            }}
                          />
                        )}

                        {/* Button content */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ fontSize: 18 }}>🎰</Text>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "900",
                              color: !selected.length || busy ? COLORS.textMuted : "#1A1200",
                              letterSpacing: 0.3,
                            }}
                          >
                            {submitting
                              ? "⏳ Processing..."
                              : `⚡ Buy ${selected.length || 0} Slot(s) — ${formatRs(totalCost)}`}
                          </Text>
                        </View>

                        {/* Subtitle */}
                        {selected.length > 0 && !busy && (
                          <Text style={{
                            color: "rgba(26, 18, 0, 0.6)",
                            fontSize: 10,
                            fontWeight: "600",
                            marginTop: 4,
                            letterSpacing: 0.5,
                          }}>
                            TAP TO ENTER THE DRAW
                          </Text>
                        )}
                      </LinearGradient>
                    </Animated.View>
                  </TouchableOpacity>
                </Animated.View>
              ) : null}

              {/* === MESSAGE / ERROR (Premium) === */}
              {message ? (
                <View style={{
                  marginTop: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(16, 185, 129, 0.25)",
                  backgroundColor: "rgba(16, 185, 129, 0.08)",
                  padding: 14,
                  alignItems: "center",
                }}>
                  <Text style={{ color: COLORS.green, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    {message}
                  </Text>
                </View>
              ) : null}
              {error ? (
                <View style={{
                  marginTop: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(245, 158, 11, 0.25)",
                  backgroundColor: "rgba(245, 158, 11, 0.08)",
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <Text style={{ fontSize: 16 }}>⚠️</Text>
                  <Text style={{ color: COLORS.orange, fontSize: 13, fontWeight: "600", flex: 1 }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* Bottom spacer */}
              <View style={{ height: 24 }} />
            </>
          ) : (
            <View style={{
              marginTop: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: COLORS.glassBorder,
              backgroundColor: COLORS.glassBg,
              padding: 30,
              alignItems: "center",
            }}>
              <Animated.Text style={{ color: COLORS.textMuted, fontSize: 14, opacity: headerFade }}>
                Loading game board...
              </Animated.Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom gold accent */}
        <View style={{ height: 2, backgroundColor: COLORS.gold, opacity: 0.4 }} />
      </SafeAreaView>
    </View>
  );
}