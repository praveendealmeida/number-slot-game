"use client";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Same-origin requests carry the Auth.js session cookie automatically.
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
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
  soldSlots: Array<{ slotNumber: number; userId: string }>;
};

export type PurchaseResponse = {
  success: true;
  slotNumbers: number[];
  amountLkr: number;
  balance: number;
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
