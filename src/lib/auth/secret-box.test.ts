import { describe, expect, it } from "vitest";

import { seal, unseal } from "@/lib/auth/secret-box";

describe("sealed secrets", () => {
  it("round-trips, and never shows the secret in what is stored", async () => {
    const sealed = await seal("1//refresh-token", "auth-secret", "drive");
    expect(sealed).not.toContain("refresh-token");
    expect(await unseal(sealed, "auth-secret", "drive")).toBe("1//refresh-token");
  });

  it("uses a fresh IV every time", async () => {
    expect(await seal("same", "auth-secret", "drive")).not.toBe(await seal("same", "auth-secret", "drive"));
  });

  it("cannot be opened with another secret or for another purpose", async () => {
    const sealed = await seal("token", "auth-secret", "drive");
    expect(await unseal(sealed, "other-secret", "drive")).toBeNull();
    expect(await unseal(sealed, "auth-secret", "other")).toBeNull();
  });

  it("rejects anything tampered with", async () => {
    const sealed = await seal("token", "auth-secret", "drive");
    const flipped = sealed.slice(0, -2) + (sealed.endsWith("A") ? "B" : "A") + sealed.slice(-1);
    expect(await unseal(flipped, "auth-secret", "drive")).toBeNull();
    expect(await unseal("not sealed", "auth-secret", "drive")).toBeNull();
  });
});
