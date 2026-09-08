import { PUBLIC_PLACES, type PublicPlace } from "@/components/place-picker";
import type { TimeWheelOption } from "@/components/time-wheel-picker";

export interface CreateFormValues {
  activity: string;
  title: string;
  purpose: string;
  start: string;
  end: string;
  place: PublicPlace | null;
  minimum: string;
  capacity: string;
  costAlcohol: string;
  preparation: string;
  facilitationTemplate: string;
}

export type CreateFormErrors = Partial<
  Record<
    "title" | "start" | "end" | "place" | "minimum" | "capacity" | "costAlcohol" | "facilitationTemplate",
    string
  >
>;
export function createTimeOptions(now = new Date()): TimeWheelOption[] {
  const sourceDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const intervalMs = 30 * 60_000;
  const roundedNow = new Date(Math.ceil(now.getTime() / intervalMs) * intervalMs);
  const firstOffsetMinutes = Math.ceil((roundedNow.getTime() - now.getTime()) / 60_000);

  return Array.from({ length: 55 }, (_, index) => {
    const offsetMinutes = firstOffsetMinutes + index * 30;
    const optionDate = new Date(now.getTime() + offsetMinutes * 60_000);
    const optionDay = new Date(
      optionDate.getFullYear(),
      optionDate.getMonth(),
      optionDate.getDate(),
    ).getTime();
    const dayOffset = Math.round((optionDay - sourceDay) / 86_400_000);
    const dayLabel = dayOffset === 0 ? "오늘" : dayOffset === 1 ? "내일" : "모레";

    return {
      value: `offset-${offsetMinutes}`,
      label: `${dayLabel} ${String(optionDate.getHours()).padStart(2, "0")}:${String(optionDate.getMinutes()).padStart(2, "0")}`,
      offsetMinutes,
      instant: optionDate.toISOString(),
    };
  });
}

function getOffsetMinutes(value: string) {
  const match = /^offset-(\d+)$/.exec(value);
  return match ? Number(match[1]) : null;
}

export function getTimeLabel(value: string, options: TimeWheelOption[]) {
  return options.find((option) => option.value === value)?.label ?? "시간 미정";
}

export const initialValues: CreateFormValues = {
  activity: "산책",
  title: "퇴근 후 한강 산책",
  purpose: "20분 산책 후 카페에서 이야기 나눠요",
  start: "offset-150",
  end: "offset-240",
  place: PUBLIC_PLACES[0] ?? null,
  minimum: "3",
  capacity: "6",
  costAlcohol: "무료 · 음주 없음",
  preparation: "",
  facilitationTemplate: "자유 진행",
};

export function createInitialValues(options: TimeWheelOption[]): CreateFormValues {
  return {
    ...initialValues,
    start: options[5]?.value ?? initialValues.start,
    end: options[8]?.value ?? initialValues.end,
  };
}

export function validateMeetupForm(values: CreateFormValues): CreateFormErrors {
  const errors: CreateFormErrors = {};
  const start = getOffsetMinutes(values.start);
  const end = getOffsetMinutes(values.end);
  const minimum = Number(values.minimum);
  const capacity = Number(values.capacity);

  if (!values.title.trim()) errors.title = "모임 제목을 입력해 주세요.";
  if (start === null || start < 0 || start > 24 * 60) {
    errors.start = "시작 시간은 생성 시점부터 24시간 안이어야 해요.";
  }
  if (end === null || (start !== null && end <= start)) {
    errors.end = "종료 시간은 시작 시간보다 늦어야 해요.";
  }
  if (!values.place || values.place.isPublic !== true) {
    errors.place = "누구나 접근할 수 있는 공개 장소를 선택해 주세요.";
  }
  if (!Number.isInteger(minimum) || minimum < 2) {
    errors.minimum = "최소 성사 인원은 2명 이상이어야 해요.";
  }
  if (!Number.isInteger(capacity) || capacity > 8 || capacity < minimum) {
    errors.capacity = "정원은 최소 인원 이상, 최대 8명이어야 해요.";
  }
  if (!values.facilitationTemplate.trim()) {
    errors.facilitationTemplate = "진행 방식을 입력해 주세요.";
  }

  return errors;
}
