import { describe, expect, it } from "vitest";

import { toRouteTemplate } from "./route-templates";

describe("toRouteTemplate", () => {
  it("reduces entity ids to a generic segment", () => {
    expect(toRouteTemplate("/meetups/a7c77e71")).toBe("/meetups/[id]");
    expect(toRouteTemplate("/meetups/a7c77e71/chat")).toBe("/meetups/[id]/chat");
    expect(toRouteTemplate("/profile/no-show-appeals/appeal-1")).toBe(
      "/profile/no-show-appeals/[id]",
    );
  });

  it("keeps real template names intact", () => {
    expect(toRouteTemplate("/meetups/[meetupId]")).toBe("/meetups/[meetupId]");
    expect(toRouteTemplate("/profile/no-show-appeals/[appealId]")).toBe(
      "/profile/no-show-appeals/[appealId]",
    );
  });

  it("passes known static routes through untouched", () => {
    expect(toRouteTemplate("/")).toBe("/");
    expect(toRouteTemplate("/filters")).toBe("/filters");
    expect(toRouteTemplate("/my-meetups")).toBe("/my-meetups");
    expect(toRouteTemplate("/connections")).toBe("/connections");
    expect(toRouteTemplate("/meetups/new")).toBe("/meetups/new");
  });
});
