import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimeWheelPicker, type TimeWheelOption } from "./time-wheel-picker";

const options: TimeWheelOption[] = [
  { value: "18:00", label: "오늘 18:00", offsetMinutes: 120 },
  { value: "18:30", label: "오늘 18:30", offsetMinutes: 150 },
  { value: "19:00", label: "오늘 19:00", offsetMinutes: 180 },
  { value: "19:30", label: "오늘 19:30", offsetMinutes: 210 },
  { value: "20:00", label: "오늘 20:00", offsetMinutes: 240 },
];

function Fixture({ onChange = vi.fn() }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("18:30");

  return (
    <TimeWheelPicker
      id="start"
      label="시작"
      value={value}
      options={options}
      onChange={(nextValue) => {
        setValue(nextValue);
        onChange(nextValue);
      }}
    />
  );
}

afterEach(() => {
  window.__setReducedMotionPreference(false);
});

describe("TimeWheelPicker", () => {
  it("selects a time from the vertical wheel and commits it", async () => {
    const onChange = vi.fn();
    render(<Fixture onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /시작, 오늘 18:30/ }));
    expect(screen.getByRole("dialog", { name: "시작 선택" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "오늘 19:30" }));
    fireEvent.click(screen.getByRole("button", { name: "적용" }));

    expect(onChange).toHaveBeenCalledWith("19:30");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /시작, 오늘 19:30/ })).toHaveFocus();
  });

  it("discards a draft selection and restores focus when cancelled", async () => {
    const onChange = vi.fn();
    render(<Fixture onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: /시작, 오늘 18:30/ });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "오늘 20:00" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("uses instant wheel positioning when reduced motion is requested", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    window.__setReducedMotionPreference(true);
    render(<Fixture />);

    fireEvent.click(screen.getByRole("button", { name: /시작, 오늘 18:30/ }));

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
    });
  });
});
