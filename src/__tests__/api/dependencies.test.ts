/**
 * __tests__/api/dependencies.test.ts
 * Tests for GET /api/dependencies — multi-hop dependency tree.
 * Tests for GET /api/blast-radius — blast radius query.
 *
 * IMPORTANT: ALL mock variables must be declared with `jest.fn()` BEFORE
 * any `jest.mock()` factory that references them, because Jest hoists
 * `jest.mock()` calls to the top of the file (temporal dead zone issue).
 * We use a single combined mock for @/lib/queries to avoid duplicate-mock conflicts.
 */

// ── Declare ALL mocks before any jest.mock() factory ──────────────────────────
const mockGetDependencyTree = jest.fn();
const mockGetBlastRadius = jest.fn();

// Single combined mock so both route files share the same module mock
jest.mock("@/lib/queries", () => ({
  getDependencyTree: mockGetDependencyTree,
  getBlastRadius: mockGetBlastRadius,
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

// ── Imports AFTER mocking ─────────────────────────────────────────────────────
import { GET } from "@/app/api/dependencies/route";
import { GET as blastGET } from "@/app/api/blast-radius/route";

function makeRequest(base: string, params: Record<string, string>): Request {
  const url = new URL(`http://localhost${base}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// /api/dependencies
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/dependencies", () => {
  it("returns 400 when name is missing", async () => {
    const res = await GET(makeRequest("/api/dependencies", {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("calls getDependencyTree with name and hops", async () => {
    mockGetDependencyTree.mockResolvedValueOnce({ nodes: [], links: [] });
    await GET(makeRequest("/api/dependencies", { name: "express", hops: "3" }));
    expect(mockGetDependencyTree).toHaveBeenCalledWith("express", 3);
  });

  it("defaults hops to 4 when not provided", async () => {
    mockGetDependencyTree.mockResolvedValueOnce({ nodes: [], links: [] });
    await GET(makeRequest("/api/dependencies", { name: "express" }));
    expect(mockGetDependencyTree).toHaveBeenCalledWith("express", 4);
  });

  it("returns graph data on success", async () => {
    const graphData = {
      nodes: [{ id: "pkg:express", label: "express", type: "root", data: {} }],
      links: [],
    };
    mockGetDependencyTree.mockResolvedValueOnce(graphData);
    const res = await GET(makeRequest("/api/dependencies", { name: "express" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nodes).toHaveLength(1);
  });

  it("returns 404 for NOT_FOUND AppError", async () => {
    mockGetDependencyTree.mockRejectedValueOnce(
      new MockAppError("not found", "NOT_FOUND")
    );
    const res = await GET(makeRequest("/api/dependencies", { name: "missing" }));
    expect(res.status).toBe(404);
  });

  it("returns 503 for non-AppError (DB unreachable)", async () => {
    mockGetDependencyTree.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = await GET(makeRequest("/api/dependencies", { name: "express" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("DB_ERROR");
  });

  it("returns 500 for generic AppError", async () => {
    mockGetDependencyTree.mockRejectedValueOnce(
      new MockAppError("something broke", "DB_ERROR")
    );
    const res = await GET(makeRequest("/api/dependencies", { name: "express" }));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/blast-radius
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/blast-radius", () => {
  it("returns 400 when name is missing", async () => {
    const res = await blastGET(makeRequest("/api/blast-radius", {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns blast radius data on success", async () => {
    const mockData = {
      results: [
        { affectedRoot: "express", pathLength: 2, pathNodes: ["express", "lodash"] },
      ],
      graphData: { nodes: [], links: [] },
    };
    mockGetBlastRadius.mockResolvedValueOnce(mockData);
    const res = await blastGET(makeRequest("/api/blast-radius", { name: "lodash" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].affectedRoot).toBe("express");
  });

  it("calls getBlastRadius with the package name and default hops=6", async () => {
    mockGetBlastRadius.mockResolvedValueOnce({ results: [], graphData: { nodes: [], links: [] } });
    await blastGET(makeRequest("/api/blast-radius", { name: "lodash" }));
    // Route calls getBlastRadius(name, hops) — hops defaults to 6
    expect(mockGetBlastRadius).toHaveBeenCalledWith("lodash", 6);
  });

  it("returns 503 on DB unreachable", async () => {
    mockGetBlastRadius.mockRejectedValueOnce(new Error("timeout"));
    const res = await blastGET(makeRequest("/api/blast-radius", { name: "lodash" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("DB_ERROR");
  });

  it("returns 500 on AppError", async () => {
    mockGetBlastRadius.mockRejectedValueOnce(
      new MockAppError("query failed", "DB_ERROR")
    );
    const res = await blastGET(makeRequest("/api/blast-radius", { name: "lodash" }));
    expect(res.status).toBe(500);
  });
});
