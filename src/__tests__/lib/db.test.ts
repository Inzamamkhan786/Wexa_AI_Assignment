/**
 * __tests__/lib/db.test.ts
 * Unit tests for the singleton Neo4j driver wrapper and AppError class.
 * All tests mock neo4j-driver so no real DB connection is required.
 */

// ── Mock neo4j-driver before importing anything that uses it ─────────────────
const mockSessionRun = jest.fn();
const mockSessionClose = jest.fn().mockResolvedValue(undefined);
const mockDriverSession = jest.fn(() => ({
  run: mockSessionRun,
  close: mockSessionClose,
}));
const mockDriverClose = jest.fn().mockResolvedValue(undefined);
const mockDriver = jest.fn(() => ({
  session: mockDriverSession,
  close: mockDriverClose,
}));

jest.mock("neo4j-driver", () => ({
  __esModule: true,
  default: {
    driver: mockDriver,
    auth: {
      basic: jest.fn((user: string, pass: string) => ({ scheme: "basic", user, pass })),
    },
  },
}));

// ── Now import the module under test ─────────────────────────────────────────
import { AppError, getDriver, runQuery, closeDriver } from "@/lib/db";

// ── Reset singleton state between tests ──────────────────────────────────────
// db.ts uses a module-level `_driver` variable. We reset it by calling closeDriver()
// or by directly clearing the singleton via module re-evaluation.
beforeEach(() => {
  jest.clearAllMocks();
  // Reset module state so _driver starts as null each test
  jest.resetModules();
});

// ─────────────────────────────────────────────────────────────────────────────
// AppError
// ─────────────────────────────────────────────────────────────────────────────
describe("AppError", () => {
  it("sets name to AppError", () => {
    const err = new AppError("something broke");
    expect(err.name).toBe("AppError");
  });

  it("defaults code to UNKNOWN_ERROR", () => {
    const err = new AppError("oops");
    expect(err.code).toBe("UNKNOWN_ERROR");
  });

  it("accepts a custom code", () => {
    const err = new AppError("not here", "NOT_FOUND");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("not here");
  });

  it("is an instance of Error", () => {
    expect(new AppError("x")).toBeInstanceOf(Error);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getDriver
// ─────────────────────────────────────────────────────────────────────────────
describe("getDriver", () => {
  const ORIGINAL_ENV = process.env;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("throws when COGNODB_URI is missing", () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.COGNODB_URI;
    process.env.COGNODB_USER = "cognodb";
    process.env.COGNODB_PASSWORD = "pass";
    // Re-import fresh module
    jest.isolateModules(() => {
      const { getDriver: freshGetDriver } = require("@/lib/db");
      expect(() => freshGetDriver()).toThrow(
        "Missing CognoDB environment variables"
      );
    });
  });

  it("throws when COGNODB_USER is missing", () => {
    process.env = { ...ORIGINAL_ENV };
    process.env.COGNODB_URI = "bolt+s://test.cognodb.cloud";
    delete process.env.COGNODB_USER;
    process.env.COGNODB_PASSWORD = "pass";
    jest.isolateModules(() => {
      const { getDriver: freshGetDriver } = require("@/lib/db");
      expect(() => freshGetDriver()).toThrow(
        "Missing CognoDB environment variables"
      );
    });
  });

  it("throws when COGNODB_PASSWORD is missing", () => {
    process.env = { ...ORIGINAL_ENV };
    process.env.COGNODB_URI = "bolt+s://test.cognodb.cloud";
    process.env.COGNODB_USER = "cognodb";
    delete process.env.COGNODB_PASSWORD;
    jest.isolateModules(() => {
      const { getDriver: freshGetDriver } = require("@/lib/db");
      expect(() => freshGetDriver()).toThrow(
        "Missing CognoDB environment variables"
      );
    });
  });

  it("creates a driver when all env vars are present", () => {
    process.env.COGNODB_URI = "bolt+s://test.cognodb.cloud";
    process.env.COGNODB_USER = "cognodb";
    process.env.COGNODB_PASSWORD = "secret";
    jest.isolateModules(() => {
      const neo4jMock = require("neo4j-driver").default;
      const { getDriver: freshGetDriver } = require("@/lib/db");
      freshGetDriver();
      expect(neo4jMock.driver).toHaveBeenCalledWith(
        "bolt+s://test.cognodb.cloud",
        expect.objectContaining({ scheme: "basic" }),
        expect.objectContaining({ maxConnectionPoolSize: 10 })
      );
    });
  });

  it("returns the same driver instance on repeated calls (singleton)", () => {
    process.env.COGNODB_URI = "bolt+s://test.cognodb.cloud";
    process.env.COGNODB_USER = "cognodb";
    process.env.COGNODB_PASSWORD = "secret";
    jest.isolateModules(() => {
      const neo4jMock = require("neo4j-driver").default;
      const { getDriver: freshGetDriver } = require("@/lib/db");
      const d1 = freshGetDriver();
      const d2 = freshGetDriver();
      expect(d1).toBe(d2);
      expect(neo4jMock.driver).toHaveBeenCalledTimes(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runQuery
// ─────────────────────────────────────────────────────────────────────────────
describe("runQuery", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env.COGNODB_URI = "bolt+s://test.cognodb.cloud";
    process.env.COGNODB_USER = "cognodb";
    process.env.COGNODB_PASSWORD = "secret";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("maps records using toObject()", async () => {
    const fakeRecord = { toObject: jest.fn(() => ({ name: "express" })) };
    mockSessionRun.mockResolvedValueOnce({ records: [fakeRecord] });

    await jest.isolateModulesAsync(async () => {
      const { runQuery: freshRunQuery } = require("@/lib/db");
      const result = await freshRunQuery("MATCH (p:Package) RETURN p.name AS name", {});
      expect(result).toEqual([{ name: "express" }]);
      expect(mockSessionClose).toHaveBeenCalledTimes(1);
    });
  });

  it("closes session even when query throws", async () => {
    mockSessionRun.mockRejectedValueOnce(new Error("connection timeout"));

    await jest.isolateModulesAsync(async () => {
      const { runQuery: freshRunQuery, AppError: FreshAppError } = require("@/lib/db");
      await expect(freshRunQuery("MATCH (x) RETURN x", {})).rejects.toBeInstanceOf(
        FreshAppError
      );
      expect(mockSessionClose).toHaveBeenCalledTimes(1);
    });
  });

  it("wraps driver errors as AppError with DB_ERROR code", async () => {
    mockSessionRun.mockRejectedValueOnce(new Error("Neo4jError: something failed"));

    await jest.isolateModulesAsync(async () => {
      const { runQuery: freshRunQuery, AppError: FreshAppError } = require("@/lib/db");
      try {
        await freshRunQuery("MATCH (x) RETURN x", {});
        fail("Expected to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(FreshAppError);
        expect((err as InstanceType<typeof FreshAppError>).code).toBe("DB_ERROR");
        expect((err as InstanceType<typeof FreshAppError>).message).toContain(
          "Graph query failed"
        );
      }
    });
  });

  it("passes cypher and params to session.run()", async () => {
    mockSessionRun.mockResolvedValueOnce({ records: [] });

    await jest.isolateModulesAsync(async () => {
      const { runQuery: freshRunQuery } = require("@/lib/db");
      const cypher = "MATCH (p:Package {name: $name}) RETURN p";
      const params = { name: "lodash" };
      await freshRunQuery(cypher, params);
      expect(mockSessionRun).toHaveBeenCalledWith(cypher, params);
    });
  });

  it("returns empty array when no records", async () => {
    mockSessionRun.mockResolvedValueOnce({ records: [] });

    await jest.isolateModulesAsync(async () => {
      const { runQuery: freshRunQuery } = require("@/lib/db");
      const result = await freshRunQuery("MATCH (x) RETURN x", {});
      expect(result).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// closeDriver
// ─────────────────────────────────────────────────────────────────────────────
describe("closeDriver", () => {
  it("calls driver.close() and resets singleton", async () => {
    process.env.COGNODB_URI = "bolt+s://test.cognodb.cloud";
    process.env.COGNODB_USER = "cognodb";
    process.env.COGNODB_PASSWORD = "secret";

    await jest.isolateModulesAsync(async () => {
      const { getDriver: freshGetDriver, closeDriver: freshCloseDriver } =
        require("@/lib/db");
      freshGetDriver(); // initialise singleton
      await freshCloseDriver();
      expect(mockDriverClose).toHaveBeenCalledTimes(1);
    });
  });

  it("is safe to call when driver was never created", async () => {
    await jest.isolateModulesAsync(async () => {
      const { closeDriver: freshCloseDriver } = require("@/lib/db");
      // Should not throw
      await expect(freshCloseDriver()).resolves.toBeUndefined();
    });
  });
});
