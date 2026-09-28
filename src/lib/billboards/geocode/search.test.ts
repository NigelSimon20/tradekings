import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { describePlace } = await import("@/lib/billboards/geocode/search");

describe("place labels", () => {
  it("reads like an address, from the most specific part to the country", () => {
    expect(
      describePlace({
        name: "Samora Machel Avenue",
        district: "Belvedere",
        city: "Harare",
        state: "Harare Province",
        country: "Zimbabwe",
      }),
    ).toBe("Samora Machel Avenue, Belvedere, Harare, Harare Province, Zimbabwe");
  });

  it("includes the street and number for a building, and never repeats a part", () => {
    expect(
      describePlace({ name: "Sam Levy's Village", housenumber: "1", street: "Borrowdale Road", city: "Harare", county: "Harare", country: "Zimbabwe" }),
    ).toBe("Sam Levy's Village, 1 Borrowdale Road, Harare, Zimbabwe");
  });
});
