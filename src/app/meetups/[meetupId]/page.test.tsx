import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MeetupDetailPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ meetupId: "demo" }),
}));

describe("MeetupDetailPage safety actions", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/meetups/demo");
  });

  it("opens the report dialog and restores its trigger after Escape and cancel", async () => {
    render(<MeetupDetailPage />);

    const reportTrigger = screen.getByRole("button", { name: "신고하기" });
    fireEvent.click(reportTrigger);

    expect(screen.getByRole("dialog", { name: "이 모임을 신고할까요?" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "안전 위협" })).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(reportTrigger).toHaveFocus();
    });

    fireEvent.click(reportTrigger);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(reportTrigger).toHaveFocus();
    });
  });

  it("requires a reason and shows a local receipt after report submission", async () => {
    render(<MeetupDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "신고하기" }));
    const submit = screen.getByRole("button", { name: "신고 내용 기록하기" });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/신고자 정보는 상대에게 공개되지 않아요/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "긴급한 안전 위협이에요" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "112" })).toHaveAttribute("href", "tel:112");

    fireEvent.click(screen.getByRole("radio", { name: "허위 장소·목적" }));
    fireEvent.change(screen.getByRole("textbox", { name: "상세 내용 (선택)" }), {
      target: { value: "소개와 실제 진행 방식이 달랐어요." },
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    const receipt = await screen.findByRole("status");
    expect(receipt).toHaveTextContent(
      "신고 내용을 이 화면에 기록했어요. 운영 검토 결과가 확정된 것은 아니에요.",
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(receipt).toHaveFocus();
    });
    expect(screen.getByRole("link", { name: "이 모임에 참여하기" })).toHaveAttribute(
      "href",
      "/meetups/demo/join",
    );
  });

  it("requires block confirmation, then hides the meetup and join action", async () => {
    render(<MeetupDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "제안자 차단" }));
    expect(screen.getByRole("dialog", { name: "모임 제안자를 차단할까요?" })).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "제안자 차단하기" });
    await waitFor(() => expect(confirm).toHaveFocus());
    fireEvent.click(confirm);

    const result = await screen.findByRole("heading", { name: "제안자를 차단했어요" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(document.getElementById("meetup-blocked-result")).toHaveFocus();
    });
    expect(result).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "퇴근 후 한강 산책" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "이 모임에 참여하기" })).not.toBeInTheDocument();
    expect(screen.getByText("차단 관계로 이 모임 정보와 참여 기능을 숨겼어요.")).toBeInTheDocument();
  });
});
