import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./convex-provider";
import { UserProvider } from "@/lib/user-context";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Yskas",
  description: "AI-powered calorie tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yskas",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${geist.className} bg-white text-gray-900 antialiased`}>
        <ConvexClientProvider>
          <UserProvider>{children}</UserProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
