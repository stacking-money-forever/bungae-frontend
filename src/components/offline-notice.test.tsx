import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OfflineNotice } from "./offline-notice";

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

afterEach(() => {
  setOnline(true);
});

describe("OfflineNotice", () => {
  it("renders nothing while the browser reports a live connection", () => {
    setOnline(true);
    render(<OfflineNotice />);
    expect(screen.queryByText("인터넷 연결이 끊겼어요")).not.toBeInTheDocument();
  });

  it("announces a polite offline hint and disappears when the connection returns", () => {
    render(<OfflineNotice />);
    expect(screen.queryByText("인터넷 연결이 끊겼어요")).not.toBeInTheDocument();

    act(() => setOnline(false));
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("인터넷 연결이 끊겼어요");
    expect(banner).toHaveTextContent("변경을 저장하거나 서버 정보를 불러올 수 없어요");
    expect(banner.getAttribute("aria-live")).toBe("polite");
    expect(banner).toHaveTextContent("연결이 돌아오면 다시 시도해 주세요.");

    act(() => setOnline(true));
    expect(screen.queryByText("인터넷 연결이 끊겼어요")).not.toBeInTheDocument();
  });

  it("stops reacting to connection changes after unmount", () => {
    setOnline(true);
    const { unmount } = render(<OfflineNotice />);
    unmount();
    act(() => setOnline(false));
    expect(screen.queryByText("인터넷 연결이 끊겼어요")).not.toBeInTheDocument();
  });
});
