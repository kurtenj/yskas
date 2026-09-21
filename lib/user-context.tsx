"use client";

import { createContext, use, useState, ReactNode } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { readProfile, writeProfile } from "./profile-storage";

interface UserContextValue {
  userId: Id<"users"> | null;
  setUserId: (id: Id<"users"> | null) => void;
  clearUser: () => void;
}

const UserContext = createContext<UserContextValue>({
  userId: null,
  setUserId: () => {},
  clearUser: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<Id<"users"> | null>(() => {
    try {
      return typeof window === "undefined"
        ? null
        : (readProfile(window.localStorage) as Id<"users"> | null);
    } catch {
      return null;
    }
  });

  function setUserId(id: Id<"users"> | null) {
    setUserIdState(id);
    try {
      writeProfile(window.localStorage, id);
    } catch {
      /* Storage may be blocked. */
    }
  }

  function clearUser() {
    setUserId(null);
  }

  return (
    <UserContext.Provider value={{ userId, setUserId, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return use(UserContext);
}
