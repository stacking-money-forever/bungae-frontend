import {
  CircleAlert,
  CircleCheck,
  Info,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

export type StatusTone = "neutral" | "warning" | "critical" | "positive";

interface ToneStyle {
  backgroundClassName: string;
  foregroundClassName: string;
  icon: LucideIcon;
}

const toneStyles: Record<StatusTone, ToneStyle> = {
  neutral: {
    backgroundClassName: "bg-[var(--bg-neutral-weak)]",
    foregroundClassName: "text-[var(--fg-neutral)]",
    icon: Info,
  },
  warning: {
    backgroundClassName: "bg-[var(--bg-warning-weak)]",
    foregroundClassName: "text-[var(--fg-warning)]",
    icon: CircleAlert,
  },
  critical: {
    backgroundClassName: "bg-[var(--bg-critical-weak)]",
    foregroundClassName: "text-[var(--fg-critical)]",
    icon: ShieldAlert,
  },
  positive: {
    backgroundClassName: "bg-[var(--bg-positive-weak)]",
    foregroundClassName: "text-[var(--fg-positive)]",
    icon: CircleCheck,
  },
};

export interface StatusBannerProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  tone?: StatusTone;
  label: string;
  description?: ReactNode;
}

export function StatusBanner({
  tone = "neutral",
  label,
  description,
  className,
  ...rest
}: StatusBannerProps) {
  const { backgroundClassName, foregroundClassName, icon: Icon } = toneStyles[tone];
  const role = tone === "critical" ? "alert" : "status";
  const ariaLive = tone === "critical" ? "assertive" : "polite";
  const bannerClassName = [
    "flex w-full items-start gap-[var(--dimension-x2)] p-[var(--dimension-x4)]",
    backgroundClassName,
    foregroundClassName,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside
      {...rest}
      className={bannerClassName}
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <Icon className="mt-0.5 shrink-0" size={20} strokeWidth={1.8} aria-hidden="true" />
      <div className="min-w-0">
        <p className="m-0 text-sm font-semibold leading-5">{label}</p>
        {description !== undefined && description !== null ? (
          <p className="m-0 text-sm leading-5">{description}</p>
        ) : null}
      </div>
    </aside>
  );
}
