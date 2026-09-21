"use client";

import { ConvexProviderWithAuth, useConvexAuth } from "convex/react";
import { convex } from "@/lib/convex";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

async function requestToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/token", { method: "POST", cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()).token;
  } catch {
    return null;
  }
}

function usePinAuth() {
  const pathname = usePathname();
  const [state, setState] = useState({ isLoading: true, isAuthenticated: false });
  const fetchAccessToken = useCallback(async () => {
    const token = await requestToken();
    setState({ isLoading: false, isAuthenticated: !!token });
    return token;
  }, []);
  useEffect(() => {
    if (pathname === "/pin") return;
    let active = true;
    void requestToken().then(token => {
      if (active) setState({ isLoading: false, isAuthenticated: !!token });
    });
    return () => { active = false; };
  }, [pathname]);
  return { ...state, fetchAccessToken };
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname !== "/pin" && !isLoading && !isAuthenticated) router.replace("/pin");
  }, [pathname, isLoading, isAuthenticated, router]);
  if (pathname === "/pin") return children;
  // Mount subscriptions only after Convex has verified the browser's JWT.
  if (!isAuthenticated) return null;
  return children;
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexProviderWithAuth client={convex} useAuth={usePinAuth}><AuthGate>{children}</AuthGate></ConvexProviderWithAuth>;
}
