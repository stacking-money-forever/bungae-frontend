import { describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@testing-library/react";

import { ConversationComposer } from "./conversation-composer";

function renderComposer(overrides: Partial<Parameters<typeof ConversationComposer>[0]> = {}) {
  const props = {
    draft: "",
    onDraftChange: vi.fn(),
    onSend: vi.fn(),
    ...overrides,
  };
  const view = render(<ConversationComposer {...props} />);
  return { ...props, view };
}

describe("ConversationComposer", () => {
  it("submits trimmed text and clears through the parent on send", () => {
    const { onSend } = renderComposer({ draft: "  안녕  " });
    fireEvent.submit(screen.getByRole("button", { name: "메시지 보내기" }).closest("form")!);
    expect(onSend).toHaveBeenCalledWith("안녕");
  });

  it("does not submit empty or over-length drafts", () => {
    const { onSend } = renderComposer({ draft: "   " });
    fireEvent.submit(screen.getByRole("button", { name: "메시지 보내기" }).closest("form")!);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("ignores Enter while an IME composition is open", () => {
    const { onSend } = renderComposer({ draft: "안녕" });
    const textarea = screen.getByRole("textbox", { name: "메시지 입력" });
    fireEvent.keyDown(textarea, { key: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyUp(textarea, { key: "Enter", isComposing: false });
    fireEvent.keyDown(textarea, { key: "Enter", isComposing: false });
    expect(onSend).toHaveBeenCalledWith("안녕");
  });

  it("keeps the draft visible and editable while disabled by a missing connection", () => {
    const onDraftChange = vi.fn();
    renderComposer({ draft: "유지할 말", onDraftChange, disabled: true, disabledReason: "인터넷 연결을 확인한 뒤 보낼 수 있어요." });
    const textarea = screen.getByRole("textbox", { name: "메시지 입력" });
    expect(textarea).toBeDisabled();
    expect(screen.getByRole("button", { name: "메시지 보내기" })).toBeDisabled();
    // The honest reason is available to assistive tech.
    expect(screen.getByText("인터넷 연결을 확인한 뒤 보낼 수 있어요.")).toBeInTheDocument();
  });

  it("renders a placeholder asking for login rather than an enabled send when unauthenticated", () => {
    renderComposer({ draft: "", disabled: true, disabledReason: "로그인한 뒤 메시지를 보낼 수 있어요." });
    expect(screen.getByRole("textbox", { name: "메시지 입력" })).toHaveAttribute("placeholder", "메시지를 보낼 수 없어요");
    expect(screen.getByRole("button", { name: "메시지 보내기" })).toBeDisabled();
  });
});
