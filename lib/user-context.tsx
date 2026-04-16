"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
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
  const [userId, setUserIdState] = useState<Id<"users"> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      setUserIdState(stored as Id<"users">);
    }
  }, []);

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
