import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createState, driveConnectUrl, readState, DRIVE_FILE_SCOPE } = await import("@/lib/auth/google-oauth");

const SECRET = "a-secret-for-testing";

describe("OAuth state", () => {
  it("carries whether the trip was to sign in or to connect Drive", async () => {
    expect(await readState(await createState("n1", "/contracts", SECRET), SECRET)).toEqual({
      nonce: "n1",
      next: "/contracts",
      purpose: "signin",
    });
    expect(await readState(await createState("n2", "/billboards/settings", SECRET, "drive"), SECRET)).toMatchObject({
      purpose: "drive",
    });
  });

  it("cannot be turned from a sign-in into a Drive connection", async () => {
    const state = await createState("n3", "/", SECRET);
    const cut = state.lastIndexOf(".");
    const [encoded, signature] = [state.slice(0, cut), state.slice(cut + 1)];
    const forged = `${encoded.replace("%7Csignin%7C", "%7Cdrive%7C")}.${signature}`;
    expect(forged).not.toBe(state);
    expect(await readState(forged, SECRET)).toBeNull();
  });

  it("keeps a return path that contains dots", async () => {
    expect((await readState(await createState("n5", "/contracts?q=a.b", SECRET), SECRET))?.next).toBe("/contracts?q=a.b");
  });

  it("never sends the person off-site afterwards", async () => {
    expect((await readState(await createState("n4", "https://evil.example", SECRET), SECRET))?.next).toBe("/");
  });
});

describe("connecting Drive", () => {
  it("asks only for the files the tracker creates, with lasting access", () => {
    const url = new URL(driveConnectUrl({ clientId: "id", redirectUri: "https://app/cb", state: "s" }));
    expect(url.searchParams.get("scope")).toBe(`openid email ${DRIVE_FILE_SCOPE}`);
    expect(DRIVE_FILE_SCOPE).toBe("https://www.googleapis.com/auth/drive.file");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toContain("consent");
  });
});
