"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Id } from "@/convex/_generated/dataModel";

const USER_KEY = "yskas_user_id";

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
  const [userId, setUserIdState] = useState<Id<"users"> | null>(
    () =>
      typeof window === "undefined"
        ? null
        : (localStorage.getItem(USER_KEY) as Id<"users"> | null),
  );

  function setUserId(id: Id<"users"> | null) {
    setUserIdState(id);
    if (id) {
      localStorage.setItem(USER_KEY, id);
    } else {
      localStorage.removeItem(USER_KEY);
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
  return useContext(UserContext);
}
