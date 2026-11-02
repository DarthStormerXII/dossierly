import { describe, expect, it } from "vitest";
import { emailCodeTemplate } from "@/lib/server/email-code-template";

describe("sign-in email", () => {
  it("provides the same leading-zero code and security instructions in HTML and plain text", () => {
    const { html, text } = emailCodeTemplate("012345");
    for (const body of [html, text]) {
      expect(body).toContain("012345");
      expect(body).toContain("10 minutes");
      expect(body).toContain("used once");
      expect(body).toContain("Never share this code");
      expect(body).toContain("ignore this email");
    }
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('role="presentation"');
    expect(html).not.toMatch(/<script|<img|href=/i);
  });

  it.each(["12345", "1234567", "<img>", "12 345", "abcdef"])("rejects invalid code content: %s", (code) => {
    expect(() => emailCodeTemplate(code)).toThrow();
  });
});
