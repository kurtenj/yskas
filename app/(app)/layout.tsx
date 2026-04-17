"use client";

import { useUser } from "@/lib/user-context";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { PlusCircle, ListNumbers, UserSwitch } from "@phosphor-icons/react";
import { motion } from "motion/react";

const tabs = [
  { href: "/add", label: "Add", icon: PlusCircle },
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
        d="M22.1533 8.31836L28.6426 1.92871L31.4385 4.72363L22.1533 14.0098V25.9902L31.4385 35.2764L28.6426 38.0723L22.1533 31.6816V40H18.1592V31.6816L11.6699 38.0723L8.87402 35.2764L18.1592 25.9902V21.9971H14.166L4.87988 31.2822L2.08496 28.4863L8.47461 21.9971H0V18.0029H8.47461L2.08496 11.5137L4.87988 8.71777L14.166 18.0029H18.1592V14.0098L8.87402 4.72363L11.6699 1.92871L18.1592 8.31836V0H22.1533V8.31836Z"
        fill="#FB2C36"
      />
      <path
        d="M34 14C37.3137 14 40 16.6863 40 20C40 23.3137 37.3137 26 34 26C30.6863 26 28 23.3137 28 20C28 16.6863 30.6863 14 34 14Z"
        fill="#FB2C36"
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
            <motion.div
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
              <motion.div
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
  const router = useRouter();
  const users = useQuery(api.users.list);

  useEffect(() => {
    if (users === undefined) return;
    if (users.length === 0 || !userId) router.replace("/select");
  }, [users, userId, router]);

  if (!userId || users === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-mist-800 border-t-mist-100 rounded-full animate-spin" />
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
