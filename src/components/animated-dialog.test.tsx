import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "./animated-dialog";

function DialogFixture() {
  const [open, setOpen] = useState(false);

  return (
    <AnimatedDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<button type="button">열기</button>}
    >
      <AnimatedDialogTitle>확인할까요?</AnimatedDialogTitle>
      <AnimatedDialogDescription>변경 결과를 확인해 주세요.</AnimatedDialogDescription>
      <div>
        <AnimatedDialogClose asChild>
          <button type="button">닫기</button>
        </AnimatedDialogClose>
        <button type="button">확인</button>
      </div>
    </AnimatedDialog>
  );
}

function DialogFixtureWithExitSpy({ onExitComplete }: { onExitComplete: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <AnimatedDialog
      open={open}
      onOpenChange={setOpen}
      onExitComplete={onExitComplete}
      trigger={<button type="button">열기</button>}
    >
      <AnimatedDialogTitle>확인할까요?</AnimatedDialogTitle>
      <AnimatedDialogDescription>변경 결과를 확인해 주세요.</AnimatedDialogDescription>
      <AnimatedDialogClose asChild>
        <button type="button">닫기</button>
      </AnimatedDialogClose>
    </AnimatedDialog>
  );
}

describe("AnimatedDialog", () => {
  it("opens with an accessible dialog boundary and restores the trigger on close", async () => {
    render(<DialogFixture />);

    const trigger = screen.getByRole("button", { name: "열기" });
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "확인할까요?" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "확인할까요?" })).toHaveClass(
      "inset-x-0",
      "bottom-0",
      "rounded-t-[24px]",
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("traps focus and dismisses when the backdrop is clicked", async () => {
    render(<DialogFixture />);

    const trigger = screen.getByRole("button", { name: "열기" });
    fireEvent.click(trigger);
    const closeButton = screen.getByRole("button", { name: "닫기" });
    const confirmButton = screen.getByRole("button", { name: "확인" });
    confirmButton.focus();
    fireEvent.keyDown(confirmButton, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    const backdrop = document.querySelector('[data-state="open"].fixed.inset-0');
    expect(backdrop).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.pointerDown(backdrop as HTMLElement);
    fireEvent.click(backdrop as HTMLElement);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("dismisses on Escape and reports completion after the exit", async () => {
    const onExitComplete = vi.fn();
    render(<DialogFixtureWithExitSpy onExitComplete={onExitComplete} />);

    const trigger = screen.getByRole("button", { name: "열기" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
    expect(onExitComplete).toHaveBeenCalledTimes(1);
  });
});
