import type { Metadata, Viewport } from "next";
import { Geist, Agdasima } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./convex-provider";
import { UserProvider } from "@/lib/user-context";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const agdasima = Agdasima({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-agdasima" });

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
  themeColor: "#090b0c",
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
        <link rel="icon" type="image/png" href="/favicon.png" />
      </head>
      <body className={`${geist.variable} ${agdasima.variable} font-sans bg-mist-950 text-mist-50 antialiased`}>
        <ConvexClientProvider>
          <UserProvider>{children}</UserProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
