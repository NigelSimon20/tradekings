import { beforeEach, describe, expect, it } from "vitest";

import { checkLoginAttempt, clearLoginAttempts, recordFailedLogin } from "@/lib/auth/rate-limit";

describe("sign-in attempt limit", () => {
  beforeEach(() => clearLoginAttempts("caller"));

  it("allows a person who mistypes a few times", () => {
    for (let attempt = 0; attempt < 7; attempt += 1) {
      expect(checkLoginAttempt("caller").allowed).toBe(true);
      recordFailedLogin("caller");
    }
    expect(checkLoginAttempt("caller").allowed).toBe(true);
  });

  it("stops guessing after eight failures", () => {
    for (let attempt = 0; attempt < 8; attempt += 1) recordFailedLogin("caller");

    const result = checkLoginAttempt("caller");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each caller separately", () => {
    for (let attempt = 0; attempt < 8; attempt += 1) recordFailedLogin("caller");
    expect(checkLoginAttempt("caller").allowed).toBe(false);
    expect(checkLoginAttempt("someone-else").allowed).toBe(true);
    clearLoginAttempts("someone-else");
  });

  it("forgets the failures once someone signs in", () => {
    for (let attempt = 0; attempt < 8; attempt += 1) recordFailedLogin("caller");
    expect(checkLoginAttempt("caller").allowed).toBe(false);

    clearLoginAttempts("caller");
    expect(checkLoginAttempt("caller").allowed).toBe(true);
  });
});
