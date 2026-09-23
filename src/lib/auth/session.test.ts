import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  passwordMatches,
  readSessionToken,
  secretsMatch,
  type SessionUser,
} from "@/lib/auth/session";

const SECRET = "a-secret-for-testing";
const USER: SessionUser = {
  email: "rutendo@example.com",
  name: "Rutendo Moyo",
  role: "HR",
  via: "google",
};

describe("sign-in session", () => {
  it("carries who signed in and what they may do", async () => {
    const token = await createSessionToken(SECRET, USER);
    expect(await readSessionToken(token, SECRET)).toMatchObject(USER);
  });

  it("keeps names with accents intact", async () => {
    const token = await createSessionToken(SECRET, { ...USER, name: "José Ndlovu" });
    expect((await readSessionToken(token, SECRET))?.name).toBe("José Ndlovu");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(SECRET, USER);
    expect(await readSessionToken(token, "another-secret")).toBeNull();
  });

  it("rejects a cookie edited to claim a bigger role", async () => {
    const token = await createSessionToken(SECRET, USER);
    const [, signature] = token.split(".");
    const forged = `${btoa(JSON.stringify({ ...USER, role: "Administrator", exp: Date.now() + 10000 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")}.${signature}`;
    expect(await readSessionToken(forged, SECRET)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const payload = btoa(JSON.stringify({ ...USER, exp: Date.now() - 1000 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const token = await createSessionToken(SECRET, USER);
    expect(await readSessionToken(`${payload}.${token.split(".")[1]}`, SECRET)).toBeNull();
  });

  it("rejects nonsense", async () => {
    for (const token of ["", "no-dot", "abc.def", undefined]) {
      expect(await readSessionToken(token, SECRET)).toBeNull();
    }
  });

  it("never matches when no password or secret is configured", () => {
    expect(passwordMatches("", "")).toBe(false);
    expect(passwordMatches("anything", "")).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch("guess", "")).toBe(false);
  });

  it("matches only the exact password", () => {
    expect(passwordMatches("correct horse", "correct horse")).toBe(true);
    expect(passwordMatches("correct hors", "correct horse")).toBe(false);
    expect(passwordMatches("Correct horse", "correct horse")).toBe(false);
  });
});
