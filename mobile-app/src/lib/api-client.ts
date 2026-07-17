import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
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
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
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

// Auth API
export async function signInWithGoogle(idToken: string): Promise<AppUser> {
  const res = await apiFetch<{ user: AppUser; token: string }>("/api/auth/callback", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
  await setStoredToken(res.token);
  return res.user;
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