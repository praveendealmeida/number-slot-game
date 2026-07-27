import AsyncStorage from "@react-native-async-storage/async-storage";

// Strip trailing slash so we never produce double-slashes (e.g. ...:3000//api/...)
// which would trigger a 301 redirect that breaks CORS preflight.
const rawBaseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");
const TOKEN_KEY = "auth_token";

export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = await getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export type AppUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: "USER" | "ADMIN";
  phoneNumber: string | null;
  phoneVerified: boolean;
  kycLevel: number;
  kycStatus: string | null;
};

export type LobbyGame = {
  id: string;
  title: string;
  ticketPrice: number;
  payoutPercent: number;
  status: string;
  winningNumber: number | null;
  soldCount: number;
  remainingSlots: number;
};

export type LobbyResponse = {
  games: LobbyGame[];
  priceTiers: Array<{ ticketPrice: number; games: LobbyGame[] }>;
};

export type GameBoardResponse = {
  game: LobbyGame;
  soldCount: number;
  remainingSlots: number;
  soldSlots: Array<{ slotNumber: number; userId: string; pending?: boolean }>;
};

export type PurchaseInitResponse = {
  checkoutUrl: string;
  orderId: string;
  amount: number;
  currency: string;
  amountLkr: number;
  slotNumbers: number[];
};

export type PaymentStatusResponse = {
  status: "paid" | "pending" | "expired" | "not_found";
  gameId: string | null;
  slotNumbers: number[];
};

export type FinanceOverview = {
  totals: {
    totalCollections: number;
    totalPayouts: number;
    platformNetRevenue: number;
    gamesDrawn: number;
    gamesOpen: number;
  };
  games: Array<{
    gameId: string;
    title: string;
    ticketPrice: number;
    payoutPercent: number;
    status: string;
    soldCount: number;
    totalCollections: number;
    payoutAmount: number;
    platformRevenue: number;
    winningNumber: number | null;
  }>;
};

export type ProfileResponse = {
  summary: {
    totalTickets: number;
    totalSpent: number;
    wins: number;
    losses: number;
    pending: number;
    totalWinnings: number;
  };
  tickets: Array<{
    id: string;
    slotLabel: string;
    pricePaid: number;
    outcome: string;
    isWinner: boolean;
    winAmount: number;
    purchasedAt: string;
    game: {
      id: string;
      title: string;
      status: string;
      winningNumber: number | null;
    };
  }>;
};

// ── Phone OTP Auth ──────────────────────────────────────────────────────

export async function sendOTP(phoneNumber: string): Promise<{ success: boolean; message: string; demoCode?: string }> {
  return apiFetch("/api/auth/phone/send-otp", {
    method: "POST",
    body: JSON.stringify({ phoneNumber }),
  });
}

export async function verifyOTP(
  phoneNumber: string,
  code: string,
): Promise<{ user: AppUser; token: string; expiresAt: string }> {
  const res = await apiFetch<{ user: AppUser; token: string; expiresAt: string }>(
    "/api/auth/phone/verify-otp",
    {
      method: "POST",
      body: JSON.stringify({ phoneNumber, code }),
    },
  );
  await setStoredToken(res.token);
  return res;
}

// ── Lottery ──────────────────────────────────────────────────────────────

export type LotteryResult = {
  drawNumber: string;
  drawDate: string;
  ticketNumber: string;
  winningNumber: string;
};

export async function fetchLatestLotteryResult(): Promise<LotteryResult | null> {
  try {
    const res = await apiFetch<{ drawNumber: string; drawDate: string; ticketNumber: string; winningNumber: string } | { result: null }>("/api/lottery/latest");
    if ("result" in res && res.result === null) return null;
    return res as LotteryResult;
  } catch {
    return null;
  }
}

// ── Daily Game ───────────────────────────────────────────────────────────

export type DailyGameData = {
  id: string;
  title: string;
  entryFee: number;
  prizeAmount: number;
  maxPlayers: number;
  currentPlayers: number;
  endTime: string;
  active: boolean;
  processed: boolean;
  winningNumber: string | null;
};

export type DailyTicketData = {
  id: string;
  gameId: string;
  selectedNumber: string;
  entryFee: number;
  status: string;
  prizeCredited: boolean;
  createdAt: string;
  game: {
    title: string;
    prizeAmount: number;
    winningNumber: string | null;
    processed: boolean;
  };
};

export type WalletData = {
  balance: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string | null;
    createdAt: string;
  }>;
};

export async function fetchDailyGame(): Promise<DailyGameData> {
  return apiFetch("/api/daily-game");
}

export async function enterDailyGame(selectedNumber: string): Promise<{ ticket: { id: string; selectedNumber: string; entryFee: number; status: string; createdAt: string }; balance: number }> {
  return apiFetch("/api/daily-game", {
    method: "POST",
    body: JSON.stringify({ selectedNumber }),
  });
}

export async function fetchMyTickets(): Promise<DailyTicketData[]> {
  return apiFetch("/api/daily-game/tickets");
}

export async function fetchWallet(): Promise<WalletData> {
  return apiFetch("/api/wallet");
}

export async function signOutUser(): Promise<void> {
  await clearStoredToken();
}

export async function fetchCurrentUser(): Promise<AppUser | null> {
  try {
    const res = await apiFetch<{ user: AppUser }>("/api/me");
    return res.user;
  } catch {
    return null;
  }
}