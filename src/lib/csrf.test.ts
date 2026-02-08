import { describe, it, expect } from "vitest";
import {
  generateCsrfToken,
  getCsrfTokenFromRequest,
  requireCsrf,
} from "./csrf";
import type { SessionData } from "@/lib/session/store";

describe("generateCsrfToken", () => {
  it("erzeugt einen nicht-leeren base64url-String", () => {
    const token = generateCsrfToken();
    expect(token).toBeTypeOf("string");
    expect(token.length).toBeGreaterThan(0);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("erzeugt bei jedem Aufruf einen anderen Token", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });
});

describe("getCsrfTokenFromRequest", () => {
  it("liest Token aus Header X-CSRF-Token", () => {
    const req = new Request("https://example.com/api", {
      headers: { "X-CSRF-Token": "abc123" },
    });
    expect(getCsrfTokenFromRequest(req)).toBe("abc123");
  });

  it("liest Token aus Body csrfToken falls kein Header", () => {
    const req = new Request("https://example.com/api");
    expect(getCsrfTokenFromRequest(req, { csrfToken: "body-token" })).toBe(
      "body-token"
    );
  });

  it("Header hat Vorrang vor Body", () => {
    const req = new Request("https://example.com/api", {
      headers: { "X-CSRF-Token": "header-token" },
    });
    expect(
      getCsrfTokenFromRequest(req, { csrfToken: "body-token" })
    ).toBe("header-token");
  });

  it("gibt null zurück wenn weder Header noch Body", () => {
    const req = new Request("https://example.com/api");
    expect(getCsrfTokenFromRequest(req)).toBeNull();
    expect(getCsrfTokenFromRequest(req, {})).toBeNull();
    expect(getCsrfTokenFromRequest(req, { other: "x" })).toBeNull();
  });

  it("trimmt Whitespace", () => {
    const req = new Request("https://example.com/api", {
      headers: { "X-CSRF-Token": "  token  " },
    });
    expect(getCsrfTokenFromRequest(req)).toBe("token");
  });
});

describe("requireCsrf", () => {
  const sessionWithToken: SessionData = {
    userId: 1,
    csrfToken: "valid-token",
  };

  it("gibt null zurück wenn Token und Session-Token übereinstimmen", () => {
    expect(requireCsrf(sessionWithToken, "valid-token")).toBeNull();
  });

  it("gibt Fehlermeldung zurück wenn Token fehlt", () => {
    expect(requireCsrf(sessionWithToken, null)).toBe("CSRF-Token fehlt.");
    expect(requireCsrf(sessionWithToken, "")).toBe("CSRF-Token fehlt.");
  });

  it("gibt Fehlermeldung zurück wenn Session keinen Token hat", () => {
    const sessionWithout: SessionData = { userId: 1 };
    expect(requireCsrf(sessionWithout, "any")).toBe("CSRF-Token fehlt.");
  });

  it("gibt Fehlermeldung zurück wenn Token nicht übereinstimmt", () => {
    expect(requireCsrf(sessionWithToken, "wrong-token")).toBe(
      "CSRF-Token ungültig."
    );
  });
});
