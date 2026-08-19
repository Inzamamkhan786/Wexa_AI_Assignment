/**
 * __tests__/api/graph-queries.test.ts
 * Tests for /api/shortest-path, /api/risk-ranking, /api/compare routes.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockGetShortestPath = jest.fn();
const mockGetRiskRanking = jest.fn();
const mockGetSharedDependencies = jest.fn();

jest.mock("@/lib/queries", () => ({
  getShortestPath: mockGetShortestPath,
  getRiskRanking: mockGetRiskRanking,
  getSharedDependencies: mockGetSharedDependencies,
}));

class MockAppError extends Error {
  code: string;
  constructor(msg: string, code = "UNKNOWN_ERROR") {
    super(msg);
    this.name = "AppError";
    this.code = code;
  }
}
jest.mock("@/lib/db", () => ({ AppError: MockAppError }));

import { GET as shortestPathGET } from "@/app/api/shortest-path/route";
import { GET as riskRankingGET } from "@/app/api/risk-ranking/route";
import { GET as compareGET } from "@/app/api/compare/route";

function makeRequest(base: string, params: Record<string, string>): Request {
  const url = new URL(`http://localhost${base}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// /api/shortest-path
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/shortest-path", () => {
  it("returns 400 when from is missing", async () => {
    const res = await shortestPathGET(makeRequest("/api/shortest-path", { to: "lodash" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 when to is missing", async () => {
    const res = await shortestPathGET(makeRequest("/api/shortest-path", { from: "express" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no path found (null result)", async () => {
    mockGetShortestPath.mockResolvedValueOnce(null);
    const res = await shortestPathGET(makeRequest("/api/shortest-path", { from: "react", to: "lodash" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns path on success", async () => {
    mockGetShortestPath.mockResolvedValueOnce({
      pathNodes: ["express", "body-parser", "lodash"],
      length: 3,
    });
    const res = await shortestPathGET(
      makeRequest("/api/shortest-path", { from: "express", to: "lodash" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pathNodes).toEqual(["express", "body-parser", "lodash"]);
    expect(body.length).toBe(3);
  });

  it("calls getShortestPath with correct params", async () => {
    mockGetShortestPath.mockResolvedValueOnce({
      pathNodes: ["a", "b"],
      length: 2,
    });
    await shortestPathGET(makeRequest("/api/shortest-path", { from: "a", to: "b" }));
    expect(mockGetShortestPath).toHaveBeenCalledWith("a", "b");
  });

  it("returns 503 on DB error", async () => {
    mockGetShortestPath.mockRejectedValueOnce(new Error("connection reset"));
    const res = await shortestPathGET(
      makeRequest("/api/shortest-path", { from: "a", to: "b" })
    );
    expect(res.status).toBe(503);
  });

  it("returns 500 on AppError", async () => {
    mockGetShortestPath.mockRejectedValueOnce(
      new MockAppError("query failed", "DB_ERROR")
    );
    const res = await shortestPathGET(
      makeRequest("/api/shortest-path", { from: "a", to: "b" })
    );
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/risk-ranking
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/risk-ranking", () => {
  it("returns ranking data on success", async () => {
    mockGetRiskRanking.mockResolvedValueOnce([
      { name: "lodash", description: "", dependentCount: 50, hasVulnerability: true, vulnerabilities: [] },
    ]);
    const res = await riskRankingGET(makeRequest("/api/risk-ranking", {}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("lodash");
  });

  it("defaults limit to 15", async () => {
    mockGetRiskRanking.mockResolvedValueOnce([]);
    await riskRankingGET(makeRequest("/api/risk-ranking", {}));
    expect(mockGetRiskRanking).toHaveBeenCalledWith(15);
  });

  it("uses provided limit param", async () => {
    mockGetRiskRanking.mockResolvedValueOnce([]);
    await riskRankingGET(makeRequest("/api/risk-ranking", { limit: "5" }));
    expect(mockGetRiskRanking).toHaveBeenCalledWith(5);
  });

  it("returns 503 on DB connection error", async () => {
    mockGetRiskRanking.mockRejectedValueOnce(new Error("ECONNRESET"));
    const res = await riskRankingGET(makeRequest("/api/risk-ranking", {}));
    expect(res.status).toBe(503);
  });

  it("returns 500 on AppError", async () => {
    mockGetRiskRanking.mockRejectedValueOnce(
      new MockAppError("db error", "DB_ERROR")
    );
    const res = await riskRankingGET(makeRequest("/api/risk-ranking", {}));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/compare
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/compare", () => {
  it("returns 400 when a is missing", async () => {
    const res = await compareGET(makeRequest("/api/compare", { b: "koa" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 when b is missing", async () => {
    const res = await compareGET(makeRequest("/api/compare", { a: "express" }));
    expect(res.status).toBe(400);
  });

  it("returns shared dependency results on success", async () => {
    mockGetSharedDependencies.mockResolvedValueOnce([
      { sharedPackage: "debug", description: "", leftVersion: "4.3.4", rightVersion: "4.3.4", versionConflict: false },
    ]);
    const res = await compareGET(makeRequest("/api/compare", { a: "express", b: "fastify" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].sharedPackage).toBe("debug");
  });

  it("calls getSharedDependencies with correct params", async () => {
    mockGetSharedDependencies.mockResolvedValueOnce([]);
    await compareGET(makeRequest("/api/compare", { a: "react", b: "vue" }));
    expect(mockGetSharedDependencies).toHaveBeenCalledWith("react", "vue");
  });

  it("returns 503 when DB is unreachable", async () => {
    mockGetSharedDependencies.mockRejectedValueOnce(new Error("connection refused"));
    const res = await compareGET(makeRequest("/api/compare", { a: "a", b: "b" }));
    expect(res.status).toBe(503);
  });

  it("returns empty array when packages share no deps", async () => {
    mockGetSharedDependencies.mockResolvedValueOnce([]);
    const res = await compareGET(makeRequest("/api/compare", { a: "react", b: "angular" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
