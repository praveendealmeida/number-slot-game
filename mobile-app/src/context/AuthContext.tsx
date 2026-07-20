import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import {
  AppUser,
  fetchCurrentUser,
  signOutUser,
  verifyOTP as apiVerifyOTP,
  getStoredToken,
} from "@/lib/api-client";

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  loginWithPhone: (phone: string, otp: string) => Promise<AppUser>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAuthenticated: false,
  loginWithPhone: async () => { throw new Error("Not implemented"); },
  refreshUser: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = await getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithPhone = useCallback(async (phone: string, otp: string): Promise<AppUser> => {
    const res = await apiVerifyOTP(phone, otp);
    setUser(res.user);
    return res.user;
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        loginWithPhone,
        refreshUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}