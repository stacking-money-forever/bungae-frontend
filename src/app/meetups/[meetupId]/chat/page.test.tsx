import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MeetupChatPage from "./page";

describe("MeetupChatPage", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    window.__setReducedMotionPreference(false);
    window.history.replaceState({}, "", "/meetups/demo/chat");
    scrollIntoView.mockClear();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
  });

  it("opens and focuses the guide when the route targets #guide", async () => {
    window.history.replaceState({}, "", "/meetups/demo/chat#guide");

    render(<MeetupChatPage />);

    const guide = await screen.findByRole("region", {
      name: "첫 10분 진행 가이드",
    });
    expect(screen.getByRole("button", { name: /첫 10분 진행 가이드/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await waitFor(() => expect(guide).toHaveFocus());
    expect(guide).toHaveClass("chat-content-reveal");
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
    });
  });

  it("opens the guide when the hash changes after mount", async () => {
    render(<MeetupChatPage />);

    expect(
      screen.queryByRole("region", { name: "첫 10분 진행 가이드" }),
    ).not.toBeInTheDocument();

    window.history.replaceState({}, "", "/meetups/demo/chat#guide");
    fireEvent(window, new HashChangeEvent("hashchange"));

    const guide = await screen.findByRole("region", {
      name: "첫 10분 진행 가이드",
    });
    expect(guide).toHaveFocus();
  });

  it("moves back to an already open guide when #guide is targeted", async () => {
    render(<MeetupChatPage />);
    fireEvent.click(screen.getByRole("button", { name: /첫 10분 진행 가이드/ }));
    const guide = await screen.findByRole("region", {
      name: "첫 10분 진행 가이드",
    });
    expect(scrollIntoView).not.toHaveBeenCalled();

    window.history.replaceState({}, "", "/meetups/demo/chat#guide");
    fireEvent(window, new HashChangeEvent("hashchange"));

    await waitFor(() => expect(guide).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
    });
  });

  it("clears the deep-link target when the guide is manually closed", async () => {
    window.history.replaceState({}, "", "/meetups/demo/chat#guide");
    render(<MeetupChatPage />);

    const toggle = screen.getByRole("button", { name: /첫 10분 진행 가이드/ });
    await screen.findByRole("region", { name: "첫 10분 진행 가이드" });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

    fireEvent.click(toggle);
    expect(window.location.hash).toBe("");
    expect(
      screen.queryByRole("region", { name: "첫 10분 진행 가이드" }),
    ).not.toBeInTheDocument();

    scrollIntoView.mockClear();
    fireEvent.click(toggle);
    expect(
      screen.getByRole("region", { name: "첫 10분 진행 가이드" }),
    ).toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("moves to the guide without smooth scrolling when reduced motion is enabled", async () => {
    window.__setReducedMotionPreference(true);
    window.history.replaceState({}, "", "/meetups/demo/chat#guide");

    render(<MeetupChatPage />);

    await screen.findByRole("region", { name: "첫 10분 진행 가이드" });
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "auto",
        block: "nearest",
      });
    });
  });

  it("keeps message submission disabled until the draft has content", () => {
    render(<MeetupChatPage />);

    const input = screen.getByRole("textbox", { name: "메시지 입력" });
    const sendButton = screen.getByRole("button", { name: "메시지 보내기" });

    expect(sendButton).toBeDisabled();
    fireEvent.change(input, { target: { value: "   " } });
    expect(sendButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "안녕하세요!" } });
    expect(sendButton).toBeEnabled();
    fireEvent.click(sendButton);

    expect(screen.getByText("안녕하세요!")).toBeInTheDocument();
    expect(screen.getByText("안녕하세요!")).toHaveClass("chat-content-reveal");
    expect(screen.getByText("넵, 6시 50분쯤 도착할게요!")).not.toHaveClass(
      "chat-content-reveal",
    );
    expect(sendButton).toBeDisabled();
  });
});
