import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { PlacePicker, PUBLIC_PLACES, type PublicPlace } from "./place-picker";

function Fixture({ onChange = vi.fn() }: { onChange?: (place: PublicPlace) => void }) {
  const [place, setPlace] = useState<PublicPlace | null>(PUBLIC_PLACES[0] ?? null);

  return (
    <PlacePicker
      id="place"
      label="장소"
      value={place}
      onChange={(nextPlace) => {
        setPlace(nextPlace);
        onChange(nextPlace);
      }}
    />
  );
}

describe("PlacePicker", () => {
  it("searches seeded public places and commits a real place selection", async () => {
    const onChange = vi.fn();
    render(<Fixture onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /장소, 망원한강공원/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "장소 검색" }), {
      target: { value: "월드컵" },
    });

    expect(screen.queryByText("망원시장 입구")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /월드컵공원 평화의공원/ }));
    fireEvent.click(screen.getByRole("button", { name: "이 장소 선택" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "world-cup-park", isPublic: true }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /장소, 월드컵공원 평화의공원/ })).toHaveFocus();
  });

  it("keeps the original place and restores focus when cancelled", async () => {
    const onChange = vi.fn();
    render(<Fixture onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: /장소, 망원한강공원/ });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("radio", { name: /망원시장 입구/ }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });
});
