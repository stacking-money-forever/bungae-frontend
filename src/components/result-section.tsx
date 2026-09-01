import {
  CircleAlert,
  CircleCheck,
  Info,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useId, type HTMLAttributes, type ReactNode } from "react";

import type { StatusTone } from "@/components/status-banner";

interface ResultToneStyle {
  backgroundClassName: string;
  foregroundClassName: string;
  icon: LucideIcon;
}

const resultToneStyles: Record<StatusTone, ResultToneStyle> = {
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

export interface ResultSectionProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  tone?: StatusTone;
  heading: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  headingId?: string;
}

export function ResultSection({
  tone = "neutral",
  heading,
  description,
  children,
  headingId,
  id,
  className,
  ...rest
}: ResultSectionProps) {
  const generatedId = useId();
  const resolvedHeadingId = headingId ?? `${generatedId}-heading`;
  const hasDescription = description !== undefined && description !== null;
  const descriptionId = hasDescription ? `${generatedId}-description` : undefined;
  const { backgroundClassName, foregroundClassName, icon: Icon } = resultToneStyles[tone];
  const sectionClassName = [
    "result-section flex w-full flex-col items-center gap-[var(--dimension-x4)] px-[var(--dimension-x5)] py-[var(--dimension-x6)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      {...rest}
      id={id}
      className={sectionClassName}
      aria-labelledby={resolvedHeadingId}
      aria-describedby={descriptionId}
    >
      <div
        className={`flex size-[72px] shrink-0 items-center justify-center rounded-full ${backgroundClassName} ${foregroundClassName}`}
        aria-hidden="true"
      >
        <Icon size={28} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <h2
        id={resolvedHeadingId}
        className="font-display w-full text-center text-[length:var(--type-headline)] font-normal leading-8 tracking-tight text-[var(--fg-neutral)]"
      >
        {heading}
      </h2>
      {hasDescription ? (
        <p
          id={descriptionId}
          className="w-full text-center text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]"
        >
          {description}
        </p>
      ) : null}
      {children !== undefined && children !== null ? (
        <div className="w-full">{children}</div>
      ) : null}
    </section>
  );
}
