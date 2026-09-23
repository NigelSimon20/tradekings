import { describe, expect, it } from "vitest";

import { buildResendPayload, describeResendError } from "@/lib/email/resend";

const EMAIL = {
  to: "hr@example.com",
  subject: "Weekly Contract Report",
  html: "<p>Report</p>",
  text: "Report",
};

describe("sending through Resend", () => {
  it("builds the request Resend expects", () => {
    expect(buildResendPayload(EMAIL, "Contract Tracker <contracts@example.com>")).toEqual({
      from: "Contract Tracker <contracts@example.com>",
      to: ["hr@example.com"],
      subject: "Weekly Contract Report",
      html: "<p>Report</p>",
      text: "Report",
    });
  });

  it("includes the copied addresses only when there are some", () => {
    expect(buildResendPayload({ ...EMAIL, cc: [] }, "a@b.com").cc).toBeUndefined();
    expect(buildResendPayload({ ...EMAIL, cc: ["boss@example.com"] }, "a@b.com").cc).toEqual([
      "boss@example.com",
    ]);
  });

  it("sends the database export as a base64 attachment", () => {
    const payload = buildResendPayload(
      {
        ...EMAIL,
        attachments: [
          { filename: "contracts.csv", content: "Name,Company\nTendai,Trade Kings", contentType: "text/csv" },
        ],
      },
      "a@b.com",
    );

    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments?.[0].filename).toBe("contracts.csv");
    expect(Buffer.from(payload.attachments![0].content, "base64").toString("utf8")).toBe(
      "Name,Company\nTendai,Trade Kings",
    );
  });

  it("only blames the key when the key is actually the problem", () => {
    expect(describeResendError(401, {})).toContain("refused the API key");
  });

  it("passes on what Resend says when the sending address is not allowed yet", () => {
    // Resend answers 403 here, which is nothing to do with the key — saying so
    // sends people to check the wrong setting.
    const notVerified = describeResendError(403, {
      message: "The tkzim.co.zw domain is not verified. Please, add and verify your domain on https://resend.com/domains",
    });
    expect(notVerified).not.toContain("API key");
    expect(notVerified).toContain("tkzim.co.zw domain is not verified");

    const testingOnly = describeResendError(403, {
      message: "You can only send testing emails to your own email address (you@example.com).",
    });
    expect(testingOnly).toContain("your own email address");
  });

  it("explains the rest in words the person can act on", () => {
    expect(describeResendError(422, { message: "The from address is invalid." })).toContain(
      "will not send from that address",
    );
    expect(describeResendError(429, {})).toContain("rate limiting");
    expect(describeResendError(500, { message: "Something broke" })).toBe("Something broke");
  });
});
