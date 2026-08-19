/**
 * __tests__/api/packages.test.ts
 * Tests for GET /api/packages — search and exact package info.
 */

// Mock the entire queries module
const mockSearchPackages = jest.fn();
const mockGetPackageInfo = jest.fn();

jest.mock("@/lib/queries", () => ({
  searchPackages: mockSearchPackages,
  getPackageInfo: mockGetPackageInfo,
}));

// Mock AppError
class MockAppError extends Error {
  code: string;
  constructor(msg: string, code = "UNKNOWN_ERROR") {
    super(msg);
    this.name = "AppError";
    this.code = code;
  }
}
jest.mock("@/lib/db", () => ({ AppError: MockAppError }));

// ── Import AFTER mocking ──────────────────────────────────────────────────────
import { GET } from "@/app/api/packages/route";

// Helper: create a minimal Request object
function makeRequest(params: Record<string, string>): Request {
  const url = new URL("http://localhost/api/packages");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/packages", () => {
  // ── Search mode ──────────────────────────────────────────────────────────
  describe("search mode (?q=)", () => {
    it("returns 400 when q is missing", async () => {
      const req = makeRequest({});
      const res = await GET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/required/i);
    });

    it("returns 400 when q is empty string", async () => {
      const req = makeRequest({ q: "" });
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it("returns search results as JSON on success", async () => {
      mockSearchPackages.mockResolvedValueOnce([
        { name: "express", description: "Fast framework", homepage: "" },
      ]);
      const req = makeRequest({ q: "express" });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("express");
    });

    it("returns 503 when database is unreachable", async () => {
      mockSearchPackages.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const req = makeRequest({ q: "express" });
      const res = await GET(req);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.code).toBe("DB_ERROR");
    });

    it("returns 500 with AppError code on query failure", async () => {
      mockSearchPackages.mockRejectedValueOnce(
        new MockAppError("Query failed", "DB_ERROR")
      );
      const req = makeRequest({ q: "express" });
      const res = await GET(req);
      expect(res.status).toBe(500);
    });
  });

  // ── Exact mode ───────────────────────────────────────────────────────────
  describe("exact mode (?exact=)", () => {
    it("returns 404 when package not found", async () => {
      mockGetPackageInfo.mockResolvedValueOnce(null);
      const req = makeRequest({ exact: "nonexistent" });
      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it("returns package info on success", async () => {
      mockGetPackageInfo.mockResolvedValueOnce({
        name: "lodash",
        description: "Utility library",
        homepage: "https://lodash.com",
        latestVersion: "4.17.21",
        deprecated: false,
        maintainers: [],
        vulnerabilities: [],
      });
      const req = makeRequest({ exact: "lodash" });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("lodash");
    });

    it("returns 503 on DB connection error", async () => {
      mockGetPackageInfo.mockRejectedValueOnce(new Error("timeout"));
      const req = makeRequest({ exact: "lodash" });
      const res = await GET(req);
      expect(res.status).toBe(503);
    });

    it("returns 404 for AppError NOT_FOUND", async () => {
      mockGetPackageInfo.mockRejectedValueOnce(
        new MockAppError("not found", "NOT_FOUND")
      );
      const req = makeRequest({ exact: "lodash" });
      const res = await GET(req);
      expect(res.status).toBe(404);
    });
  });
});
