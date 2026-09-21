"use client";

import { useUser } from "@/lib/user-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { redirect } from "next/navigation";
import { LazyMotion, MotionConfig, domMax } from "motion/react";
import { MealInput } from "./meal-input";
import { validProfile } from "@/lib/profile-storage";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();
  const users = useQuery(api.users.list);
  const pathname = usePathname();

  if (users === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-mist-800 border-t-mist-100 rounded-full animate-spin" />
      </div>
    );
  }

  if (!validProfile(userId, users)) {
    redirect("/select");
  }

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax}>
        <main
          key={`page:${userId}`}
          className={
            pathname === "/" ? "h-dvh overflow-hidden" : "min-h-screen pb-28"
          }
        >
          {children}
        </main>
        {pathname === "/" && <MealInput key={`meal-input:${userId}`} />}
      </LazyMotion>
    </MotionConfig>
  );
}
