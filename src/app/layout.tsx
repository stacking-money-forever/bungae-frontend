import type { Metadata } from "next";
import { Do_Hyeon, Gowun_Dodum } from "next/font/google";
import { Suspense } from "react";

import { PageTransition } from "@/components/page-transition";
import { PersistentBottomNavigation } from "@/components/persistent-bottom-navigation";

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

export const metadata: Metadata = {
  title: "벙개",
  description: "오늘 가까운 곳에서 만나는 작은 모임",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${doHyeon.variable} ${gowunDodum.variable}`}>
      <body>
        <Suspense
          fallback={
            <div className="route-stage">
              <div className="route-transition">{children}</div>
            </div>
          }
        >
          <PageTransition>{children}</PageTransition>
        </Suspense>
        <PersistentBottomNavigation />
      </body>
    </html>
  );
}
