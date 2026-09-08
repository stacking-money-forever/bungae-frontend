import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export type MeetupStatus = "needs-members" | "confirmed";

export interface MeetupListRowProps {
  imageSrc: string;
  imageAlt: string;
  time: string;
  title: string;
  currentParticipants: number;
  minimumParticipants: number;
  capacity: number;
  status: MeetupStatus;
  href: string;
}

export function MeetupListRow({
  imageSrc,
  imageAlt,
  time,
  title,
  currentParticipants,
  minimumParticipants,
  capacity,
  status,
  href,
}: MeetupListRowProps) {
  const missingParticipants = Math.max(minimumParticipants - currentParticipants, 0);
  const statusLabel = status === "confirmed" ? "성사 확정" : `${missingParticipants}명 부족`;
  return (
    <li className="meetup-list-row">
      <Link
        className="meetup-list-row__link"
        href={href}
        aria-label={`${time} ${title}, 현재 ${currentParticipants}명, 최소 ${minimumParticipants}명, 정원 ${capacity}명, ${statusLabel}`}
      >
        <Image
          className="meetup-list-row__image"
          src={imageSrc}
          alt={imageAlt}
          width={512}
          height={384}
          sizes="(max-width: 430px) calc((100vw - 44px) / 2), 193px"
          loading="lazy"
          decoding="async"
        />
        <span className="meetup-list-row__details">
          <span className="meetup-list-row__heading">
            <time
              className="meetup-list-row__time font-display !text-[length:var(--type-time)] !leading-6"
              dateTime={time}
            >
              {time}
            </time>
            <span className="meetup-list-row__status">
              {status === "confirmed" ? (
                <>
                  <Check size={14} strokeWidth={1.8} aria-hidden="true" />
                  <span>{statusLabel}</span>
                </>
              ) : (
                <>
                  <span>{statusLabel}</span>
                  <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
                </>
              )}
            </span>
          </span>
          <span className="meetup-list-row__title !text-[length:var(--type-title)] !leading-5">{title}</span>
          <span className="meetup-list-row__count !text-[length:var(--type-meta)] !leading-4">
            현재 {currentParticipants}명 · 최소 {minimumParticipants}명 · 정원 {capacity}명
          </span>
        </span>
      </Link>
    </li>
  );
}
