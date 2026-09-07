import { describe, expect, it } from "vitest";

import { readFiltersFromSearch, serializeHomeFilters } from "./home-surface";

describe("home discovery filter contract", () => {
  it("falls back to the default neighborhood for empty and invalid queries", () => {
    expect(readFiltersFromSearch(new URLSearchParams())).toMatchObject({
      location: "마포구 망원동",
      activity: "전체",
      time: "24시간",
      distance: "2km 이내",
      costAlcohol: "전체",
      availableOnly: false,
    });
    expect(
      readFiltersFromSearch(new URLSearchParams("activity=NOPE&distance=garbage&available=2")),
    ).toMatchObject({
      activity: "전체",
      distance: "2km 이내",
      availableOnly: false,
    });
  });

  it("reads and round-trips every shared filter value", () => {
    const filters = {
      location: "마포구 합정동",
      activity: "산책",
      time: "오늘 저녁",
      distance: "5km 이내",
      costAlcohol: "무료 · 음주 없음",
      availableOnly: true,
    };
    const restored = readFiltersFromSearch(new URLSearchParams(serializeHomeFilters(filters)));
    expect(restored).toEqual(filters);
  });

  it("drops default-valued keys from the serialized query", () => {
    expect(serializeHomeFilters({ ...readFiltersFromSearch(null), location: "마포구 합정동" })).toBe(
      "location=%EB%A7%88%ED%8F%AC%EA%B5%AC+%ED%95%A9%EC%A0%95%EB%8F%99",
    );
  });
});
