import { createContext, useContext, useEffect, ReactNode } from "react";
import { useGetMe, useLogout, setAuthTokenGetter } from "@workspace/api-client-react";
import { useLocation } from "wouter";

const TOKEN_KEY = "polo_auth_token";

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}

setAuthTokenGetter(() => getStoredToken());

type UserRole = "spectator" | "team_manager" | "admin" | "super_admin";

interface AuthContextType {
  user: any | null;
  isLoading: boolean;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const hasToken = !!getStoredToken();
  const { data: user, isLoading } = useGetMe({
    query: {
      enabled: hasToken,
      retry: false,
      refetchOnWindowFocus: false,
    } as any,
  });

  const [, setLocation] = useLocation();
  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        clearStoredToken();
        window.location.href = "/";
      }
    }
  });

  const value: AuthContextType = {
    user: user || null,
    isLoading: hasToken ? isLoading : false,
    logout: () => {
      clearStoredToken();
      logoutMutation.mutate();
    },
    isAuthenticated: !!user,
    hasRole: (role: UserRole) => {
      if (!user) return false;
      return user.role === role;
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
