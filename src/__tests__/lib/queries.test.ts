/**
 * __tests__/lib/queries.test.ts
 * Unit tests for all 6 Cypher query functions.
 * Mocks runQuery and neo4j-driver so no real DB is required.
 */

// ── Mock runQuery (the DB layer) ─────────────────────────────────────────────
const mockRunQuery = jest.fn();
jest.mock("@/lib/db", () => ({
  runQuery: mockRunQuery,
  AppError: class AppError extends Error {
    code: string;
    constructor(msg: string, code = "UNKNOWN_ERROR") {
      super(msg);
      this.name = "AppError";
      this.code = code;
    }
  },
}));

// ── Mock neo4j-driver (integer helpers) ──────────────────────────────────────
jest.mock("neo4j-driver", () => ({
  __esModule: true,
  default: {
    integer: {
      toNumber: jest.fn((val: unknown) => {
        // If val is a plain number (from our mocks), just return it
        if (typeof val === "number") return val;
        // If val is a neo4j Integer-like object, unwrap it
        if (typeof val === "object" && val !== null && "low" in val) {
          return (val as { low: number }).low;
        }
        return Number(val);
      }),
    },
    int: jest.fn((n: number) => ({ low: n, high: 0 })),
  },
}));

import {
  getDependencyTree,
  getBlastRadius,
  getShortestPath,
  getRiskRanking,
  getSharedDependencies,
  getPackageInfo,
  searchPackages,
} from "@/lib/queries";
import { AppError } from "@/lib/db";

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// getDependencyTree
// ─────────────────────────────────────────────────────────────────────────────
describe("getDependencyTree", () => {
  it("throws NOT_FOUND AppError when runQuery returns empty", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    await expect(getDependencyTree("nonexistent")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: expect.stringContaining("nonexistent"),
    });
  });

  it("builds graph with root node from first row", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        rootName: "express",
        rootVersion: "4.18.2",
        depName: "express",
        depDesc: "Fast web framework",
        depVersion: "4.18.2",
        depDeprecated: false,
        relChain: [],
      },
    ]);

    const result = await getDependencyTree("express");
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      id: "pkg:express",
      label: "express",
      type: "root",
    });
    expect(result.links).toHaveLength(0);
  });

  it("marks deprecated packages with type=deprecated", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        rootName: "myapp",
        rootVersion: "1.0.0",
        depName: "myapp",
        depDesc: "",
        depVersion: "1.0.0",
        depDeprecated: false,
        relChain: [],
      },
      {
        rootName: "myapp",
        rootVersion: "1.0.0",
        depName: "old-pkg",
        depDesc: "deprecated lib",
        depVersion: "0.1.0",
        depDeprecated: true,
        relChain: [{ type: "DEPENDS_ON", range: "^0.1.0" }],
      },
    ]);

    const result = await getDependencyTree("myapp");
    const deprecated = result.nodes.find((n) => n.label === "old-pkg");
    expect(deprecated?.type).toBe("deprecated");
  });

  it("creates DEPENDS_ON links between root and deps", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        rootName: "express",
        rootVersion: "4.18.2",
        depName: "express",
        depDesc: "",
        depVersion: "4.18.2",
        depDeprecated: false,
        relChain: [],
      },
      {
        rootName: "express",
        rootVersion: "4.18.2",
        depName: "qs",
        depDesc: "querystring",
        depVersion: "6.11.0",
        depDeprecated: false,
        relChain: [{ type: "DEPENDS_ON", range: "6.11.0" }],
      },
    ]);

    const result = await getDependencyTree("express");
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toMatchObject({
      source: "pkg:express",
      target: "pkg:qs",
      type: "DEPENDS_ON",
      versionRange: "6.11.0",
    });
  });

  it("deduplicates nodes that appear multiple times", async () => {
    // qs appears in two different dep rows
    mockRunQuery.mockResolvedValueOnce([
      {
        rootName: "express",
        rootVersion: "4.18.2",
        depName: "express",
        depDesc: "",
        depVersion: "4.18.2",
        depDeprecated: false,
        relChain: [],
      },
      {
        rootName: "express",
        rootVersion: "4.18.2",
        depName: "qs",
        depDesc: "",
        depVersion: "6.11.0",
        depDeprecated: false,
        relChain: [{ type: "DEPENDS_ON", range: "^6" }],
      },
      {
        rootName: "express",
        rootVersion: "4.18.2",
        depName: "qs",
        depDesc: "",
        depVersion: "6.11.0",
        depDeprecated: false,
        relChain: [{ type: "DEPENDS_ON", range: "^6" }],
      },
    ]);

    const result = await getDependencyTree("express");
    const qsNodes = result.nodes.filter((n) => n.label === "qs");
    expect(qsNodes).toHaveLength(1);
  });

  it("clamps hops to [1, 6]", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        rootName: "x",
        rootVersion: "1.0.0",
        depName: "x",
        depDesc: "",
        depVersion: "1.0.0",
        depDeprecated: false,
        relChain: [],
      },
    ]);

    await getDependencyTree("x", 99); // hops=99 should be clamped to 6
    const cypher = mockRunQuery.mock.calls[0][0] as string;
    // Should use 6, not 99
    expect(cypher).toContain("DEPENDS_ON*0..6");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBlastRadius
// ─────────────────────────────────────────────────────────────────────────────
describe("getBlastRadius", () => {
  it("returns empty results when no rows", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    const result = await getBlastRadius("unknown-pkg");
    expect(result.results).toHaveLength(0);
    expect(result.graphData.nodes).toHaveLength(0);
  });

  it("builds blast radius results from rows", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        rootName: "express",
        pathLen: 3,
        pkgPath: ["express", "body-parser", "lodash"],
        vulnId: "VULN-001",
        vulnSeverity: "critical",
        vulnSummary: "Prototype pollution",
        vulnCveId: "CVE-2020-28500",
      },
    ]);

    const result = await getBlastRadius("lodash");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      affectedRoot: "express",
      pathLength: 3,
      pathNodes: ["express", "body-parser", "lodash"],
      vulnerability: {
        id: "VULN-001",
        severity: "critical",
        summary: "Prototype pollution",
        cveId: "CVE-2020-28500",
      },
    });
  });

  it("marks target package node with type=target", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        rootName: "myapp",
        pathLen: 2,
        pkgPath: ["myapp", "lodash"],
        vulnId: null,
        vulnSeverity: null,
        vulnSummary: null,
        vulnCveId: null,
      },
    ]);

    const result = await getBlastRadius("lodash");
    const targetNode = result.graphData.nodes.find((n) => n.label === "lodash");
    expect(targetNode?.type).toBe("target");
  });

  it("marks first path node as root type", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        rootName: "myapp",
        pathLen: 2,
        pkgPath: ["myapp", "lodash"],
        vulnId: null,
        vulnSeverity: null,
        vulnSummary: null,
        vulnCveId: null,
      },
    ]);

    const result = await getBlastRadius("lodash");
    const rootNode = result.graphData.nodes.find((n) => n.label === "myapp");
    expect(rootNode?.type).toBe("root");
  });

  it("omits vulnerability when vulnId is null", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        rootName: "app",
        pathLen: 1,
        pkgPath: ["app", "pkg"],
        vulnId: null,
        vulnSeverity: null,
        vulnSummary: null,
        vulnCveId: null,
      },
    ]);

    const result = await getBlastRadius("pkg");
    expect(result.results[0].vulnerability).toBeUndefined();
  });

  it("generates DEPENDS_ON links between consecutive path nodes", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        rootName: "app",
        pathLen: 3,
        pkgPath: ["app", "middle", "lodash"],
        vulnId: null,
        vulnSeverity: null,
        vulnSummary: null,
        vulnCveId: null,
      },
    ]);

    const result = await getBlastRadius("lodash");
    expect(result.graphData.links).toHaveLength(2);
    expect(result.graphData.links[0]).toMatchObject({
      source: "pkg:app",
      target: "pkg:middle",
    });
    expect(result.graphData.links[1]).toMatchObject({
      source: "pkg:middle",
      target: "pkg:lodash",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getShortestPath
// ─────────────────────────────────────────────────────────────────────────────
describe("getShortestPath", () => {
  it("returns null when no path found", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    const result = await getShortestPath("express", "angular");
    expect(result).toBeNull();
  });

  it("returns path nodes and length", async () => {
    mockRunQuery.mockResolvedValueOnce([
      { pkgPath: ["express", "body-parser", "lodash"], pathLen: 3 },
    ]);

    const result = await getShortestPath("express", "lodash");
    expect(result).toEqual({
      pathNodes: ["express", "body-parser", "lodash"],
      length: 3,
    });
  });

  it("passes from and to as parameters", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    await getShortestPath("react", "lodash");
    expect(mockRunQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ from: "react", to: "lodash" })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRiskRanking
// ─────────────────────────────────────────────────────────────────────────────
describe("getRiskRanking", () => {
  it("returns empty array when no rows", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    const result = await getRiskRanking();
    expect(result).toEqual([]);
  });

  it("maps rows to RiskRankEntry correctly", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        name: "lodash",
        description: "Utility library",
        dependantCount: 42,
        vulns: [
          {
            id: "VULN-001",
            severity: "critical",
            summary: "Prototype pollution",
            cveId: "CVE-2020-28500",
          },
        ],
      },
    ]);

    const result = await getRiskRanking(10);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "lodash",
      description: "Utility library",
      dependentCount: 42,
      hasVulnerability: true,
      vulnerabilities: expect.arrayContaining([
        expect.objectContaining({ id: "VULN-001" }),
      ]),
    });
  });

  it("filters out null vulnerability entries", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        name: "safe-pkg",
        description: "Safe",
        dependantCount: 5,
        vulns: [{ id: null, severity: null, summary: null, cveId: null }],
      },
    ]);

    const result = await getRiskRanking();
    expect(result[0].hasVulnerability).toBe(false);
    expect(result[0].vulnerabilities).toHaveLength(0);
  });

  it("uses default limit of 15 when not provided", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    await getRiskRanking();
    const params = mockRunQuery.mock.calls[0][1] as Record<string, unknown>;
    // neo4j.int(15) is mocked to return { low: 15, high: 0 }
    expect(params.limit).toEqual({ low: 15, high: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSharedDependencies
// ─────────────────────────────────────────────────────────────────────────────
describe("getSharedDependencies", () => {
  it("returns empty array when no shared deps", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    const result = await getSharedDependencies("react", "vue");
    expect(result).toEqual([]);
  });

  it("maps shared dependency rows correctly", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        sharedPkg: "debug",
        sharedDesc: "Debug utility",
        leftVer: "4.3.4",
        rightVer: "4.3.4",
        sharedVer: "4.3.4",
        hasConflict: false,
      },
      {
        sharedPkg: "ms",
        sharedDesc: "ms utility",
        leftVer: "2.1.2",
        rightVer: "2.0.0",
        sharedVer: "2.1.2",
        hasConflict: true,
      },
    ]);

    const result = await getSharedDependencies("express", "fastify");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      sharedPackage: "debug",
      description: "Debug utility",
      leftVersion: "4.3.4",
      rightVersion: "4.3.4",
      versionConflict: false,
    });
    expect(result[1].versionConflict).toBe(true);
  });

  it("passes pkgA and pkgB as parameters", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    await getSharedDependencies("express", "koa");
    expect(mockRunQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ pkgA: "express", pkgB: "koa" })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPackageInfo
// ─────────────────────────────────────────────────────────────────────────────
describe("getPackageInfo", () => {
  it("returns null when package not found", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    const result = await getPackageInfo("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when row has no name (empty graph match)", async () => {
    mockRunQuery.mockResolvedValueOnce([{ name: null }]);
    const result = await getPackageInfo("ghost");
    expect(result).toBeNull();
  });

  it("maps package info correctly", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        name: "express",
        description: "Fast web framework",
        homepage: "https://expressjs.com",
        latestVersion: "4.18.2",
        publishedAt: "2023-01-01T00:00:00.000Z",
        deprecated: false,
        maintainers: ["tj", "dougwilson"],
        vulns: [
          {
            id: "VULN-X",
            severity: "high",
            summary: "Some vuln",
            cveId: "CVE-2024-0001",
          },
        ],
      },
    ]);

    const result = await getPackageInfo("express");
    expect(result).toMatchObject({
      name: "express",
      description: "Fast web framework",
      homepage: "https://expressjs.com",
      latestVersion: "4.18.2",
      deprecated: false,
      maintainers: ["tj", "dougwilson"],
    });
    expect(result?.vulnerabilities).toHaveLength(1);
  });

  it("filters out null vulnerability entries", async () => {
    mockRunQuery.mockResolvedValueOnce([
      {
        name: "lodash",
        description: "",
        homepage: "",
        latestVersion: "4.17.21",
        publishedAt: "",
        deprecated: false,
        maintainers: [],
        vulns: [{ id: null, severity: null, summary: null, cveId: null }],
      },
    ]);

    const result = await getPackageInfo("lodash");
    expect(result?.vulnerabilities).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// searchPackages
// ─────────────────────────────────────────────────────────────────────────────
describe("searchPackages", () => {
  it("returns empty array when no matches", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    const result = await searchPackages("xyznonexistent");
    expect(result).toEqual([]);
  });

  it("maps rows to PackageNode shape", async () => {
    mockRunQuery.mockResolvedValueOnce([
      { name: "express", description: "Fast web framework", homepage: "https://expressjs.com" },
      { name: "express-ws", description: "WebSocket support", homepage: "" },
    ]);

    const result = await searchPackages("express");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: "express",
      description: "Fast web framework",
      homepage: "https://expressjs.com",
    });
  });

  it("passes query string as parameter $q", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    await searchPackages("lodash");
    expect(mockRunQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ q: "lodash" })
    );
  });

  it("defaults description to empty string when null", async () => {
    mockRunQuery.mockResolvedValueOnce([
      { name: "no-desc", description: null, homepage: null },
    ]);

    const result = await searchPackages("no-desc");
    expect(result[0].description).toBe("");
    expect(result[0].homepage).toBe("");
  });

  it("uses default limit of 10", async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    await searchPackages("test");
    const params = mockRunQuery.mock.calls[0][1] as Record<string, unknown>;
    expect(params.limit).toEqual({ low: 10, high: 0 });
  });
});
