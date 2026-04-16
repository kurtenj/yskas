"use client";

import { useUser } from "@/lib/user-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { House, Plus, ClockCounterClockwise, Gear } from "@phosphor-icons/react";

function NavBar() {
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: "Today", icon: House },
    { href: "/add", label: "Add", icon: Plus },
    { href: "/history", label: "History", icon: ClockCounterClockwise },
    { href: "/settings", label: "Settings", icon: Gear },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 pb-safe">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
              active ? "text-gray-900" : "text-gray-400"
            }`}
          >
            <Icon size={24} />
            <span className="text-xs font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AppGuard({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();
  const router = useRouter();
  const users = useQuery(api.users.list);

  useEffect(() => {
    if (users === undefined) return; // loading

    if (users.length === 0) {
      // No profiles yet — go to onboarding
      router.replace("/select");
      return;
    }

    if (!userId) {
      // Profiles exist but none selected
      router.replace("/select");
    }
  }, [users, userId, router]);

  if (!userId || users === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen pb-20">{children}</main>
      <NavBar />
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppGuard>{children}</AppGuard>;
}

