import { describe, expect, it } from "vitest";

import { render, screen } from "@testing-library/react";

import type { Message } from "@/lib/api/types";
import { ConversationMessageList } from "./conversation-message-list";

const mine: Message = {
  id: "mine-1",
  sender: { userId: "user-a", displayName: "민지" },
  text: "내가 보낸 메시지\n둘째 줄",
  createdAt: "2026-09-07T10:00:00.000Z",
};
const other: Message = {
  id: "other-1",
  sender: { userId: "user-b", displayName: "준호" },
  text: "상대 메시지",
  createdAt: "2026-09-07T10:01:00.000Z",
};

function renderList(messages: Message[]) {
  return render(
    <ConversationMessageList
      messages={messages}
      currentUserId="user-a"
      onLoadOlder={null}
      loadingOlder={false}
      appendError={null}
    />,
  );
}

describe("ConversationMessageList", () => {
  it("renders sender display name, text, and time; never renders userId", () => {
    renderList([mine, other]);
    expect(screen.getByText("민지")).toBeInTheDocument();
    expect(screen.getByText("상대 메시지")).toBeInTheDocument();
    expect(screen.queryByText("user-b")).not.toBeInTheDocument();
  });

  it("renders newlines and long unbroken text without executing HTML", () => {
    renderList([{ ...mine, text: "line1\nline2<script>alert(1)</script>" }]);
    expect(screen.getByText(/line1/)).toBeInTheDocument();
    expect(document.querySelector("script")).not.toBeInTheDocument();
  });

  it("renders an explicit append error and retry action when one is provided", () => {
    const retry = () => undefined;
    render(
      <ConversationMessageList
        messages={[mine]}
        currentUserId="user-a"
        onLoadOlder={retry}
        loadingOlder={false}
        appendError="이전 메시지를 불러오지 못했어요."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("이전 메시지를 불러오지 못했어요.");
    expect(screen.getByRole("button", { name: "메시지 더 보기 다시 시도" })).toBeInTheDocument();
  });

  it("shows the load-older action when a cursor exists", () => {
    const load = () => undefined;
    render(
      <ConversationMessageList
        messages={[mine]}
        currentUserId="user-a"
        onLoadOlder={load}
        loadingOlder
        appendError={null}
      />,
    );
    expect(screen.getByRole("button", { name: "메시지를 더 불러오는 중…" })).toBeDisabled();
  });

  it("labels an unknown created time honestly instead of a raw date", () => {
    renderList([{ ...mine, createdAt: "not-a-date" }]);
    expect(screen.getByText("시각을 확인할 수 없어요")).toBeInTheDocument();
  });
});
