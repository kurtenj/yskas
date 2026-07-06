"use client";

import { useUser } from "@/lib/user-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { redirect, usePathname } from "next/navigation";
import Link from "next/link";
import { ListNumbers, UserSwitch } from "@phosphor-icons/react";
import { LazyMotion, MotionConfig, domMax, m } from "motion/react";
import { MealInput } from "./meal-input";

const tabs = [
  { href: "/history", label: "History", icon: ListNumbers },
  { href: "/settings", label: "Settings", icon: UserSwitch },
] as const;

function Logo({ className }: { className?: string }) {
  return (
    <svg
      width="26"
      height="26"
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.15 8.32L28.64 1.93L31.44 4.72L22.15 14.01V25.99L31.44 35.28L28.64 38.07L22.15 31.68V40H18.16V31.68L11.67 38.07L8.87 35.28L18.16 25.99V21.997H14.17L4.88 31.28L2.08 28.49L8.47 22H0V18H8.47L2.08 11.51L4.88 8.72L14.17 18H18.16V14.01L8.87 4.72L11.67 1.93L18.16 8.32V0H22.15V8.32Z"
        fill="#55C8DD"
      />
      <path
        d="M34 14C37.31 14 40 16.69 40 20C40 23.31 37.31 26 34 26C30.69 26 28 23.31 28 20C28 16.69 30.69 14 34 14Z"
        fill="#55C8DD"
      />
    </svg>
  );
}

function NavBar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="fixed left-0 bottom-6 right-6 flex justify-end z-50">
      <nav className="flex items-center gap-1 bg-mist-900/75 backdrop-blur-sm rounded-full overflow-hidden p-1 border border-mist-800">
        <Link
          href="/"
          aria-label="Today"
          className="relative w-14 h-14 flex items-center justify-center"
        >
          {isActive("/") && (
            <m.div
              layoutId="nav-indicator"
              className="absolute inset-0 rounded-full bg-mist-700/50"
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
            />
          )}
          <Logo className="relative z-10" />
        </Link>
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`relative flex items-center justify-center w-14 h-14 transition-colors ${
              isActive(href) ? "text-mist-200" : "text-mist-600"
            }`}
          >
            {isActive(href) && (
              <m.div
                layoutId="nav-indicator"
                className="absolute inset-0 rounded-full bg-mist-700/50"
                transition={{ type: "spring", stiffness: 350, damping: 22 }}
              />
            )}
            <Icon size={32} weight="regular" className="relative z-10" />
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();
  const users = useQuery(api.users.list);

  if (users === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-mist-800 border-t-mist-100 rounded-full animate-spin" />
      </div>
    );
  }

  if (users.length === 0 || !userId) {
    redirect("/select");
  }

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax}>
        <main className="min-h-screen pb-40">{children}</main>
        <MealInput />
        <NavBar />
      </LazyMotion>
    </MotionConfig>
  );
}
