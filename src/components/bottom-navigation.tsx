import Link from "next/link";
import { Bell, CalendarDays, Compass, type LucideIcon } from "lucide-react";

export type BottomNavigationTab = "explore" | "my-meetups" | "notifications";

export interface BottomNavigationProps {
  activeTab: BottomNavigationTab;
}

type NavigationItem = {
  id: BottomNavigationTab;
  label: string;
  href: string;
  icon: LucideIcon;
};

const navigationItems: NavigationItem[] = [
  { id: "explore", label: "탐색", href: "/", icon: Compass },
  { id: "my-meetups", label: "내 모임", href: "/my-meetups", icon: CalendarDays },
  { id: "notifications", label: "알림", href: "/notifications", icon: Bell },
];

export function BottomNavigation({ activeTab }: BottomNavigationProps) {
  return (
    <nav className="bottom-navigation" aria-label="주요 메뉴">
      {navigationItems.map(({ id, label, href, icon: Icon }) => {
        const isActive = id === activeTab;

        return (
          <Link
            key={id}
            className="bottom-navigation__item"
            href={href}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="bottom-navigation__icon" size={24} strokeWidth={1.8} aria-hidden="true" />
            <span className="bottom-navigation__label text-[12px] leading-4">{label}</span>
            {isActive ? <span className="bottom-navigation__active-mark" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
