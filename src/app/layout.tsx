import type { Metadata, Viewport } from "next";
import { Do_Hyeon, Gowun_Dodum } from "next/font/google";
import { Suspense } from "react";

import { AuthSessionProvider } from "@/lib/auth/auth-session-provider";
import { ClientErrorObserver } from "@/components/client-error-observer";
import { PwaRoot } from "@/components/pwa-root";
import { PageTransition } from "@/components/page-transition";
import { PersistentBottomNavigation } from "@/components/persistent-bottom-navigation";
import { ScreenLoading } from "@/components/screen-loading";

import "./globals.css";

const doHyeon = Do_Hyeon({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const gowunDodum = Gowun_Dodum({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-body",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFD60A",
};

export const metadata: Metadata = {
  title: "벙개",
  description: "오늘 가까운 곳에서 만나는 작은 모임",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "벙개",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

/**
 * Static shell fallback shown while the route transition client island
 * hydrates. It deliberately never mirrors `children`, so it cannot present
 * stale route DOM or suspend again.
 */
function ShellFallback() {
  return (
    <div className="route-stage">
      <div className="route-gesture-surface route-gesture-surface--foreground">
        <div className="route-transition">
          <ScreenLoading variant="list" />
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${doHyeon.variable} ${gowunDodum.variable}`}>
      <body>
        <ClientErrorObserver />
        <AuthSessionProvider>
          <Suspense fallback={<ShellFallback />}>
            <PageTransition>{children}</PageTransition>
          </Suspense>
          <PersistentBottomNavigation />
          <PwaRoot />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
