/**
 * lib/db.ts
 * Singleton Neo4j driver pointing at CognoDB.
 * All queries must be parameterised — no string concatenation.
 */
import neo4j, { Driver, Session, QueryResult } from "neo4j-driver";

let _driver: Driver | null = null;

export function getDriver(): Driver {
  if (_driver) return _driver;

  const uri = process.env.COGNODB_URI;
  const user = process.env.COGNODB_USER;
  const password = process.env.COGNODB_PASSWORD;

  if (!uri || !user || !password) {
    throw new Error(
      "Missing CognoDB environment variables. Check COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD."
    );
  }

  _driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    maxConnectionPoolSize: 10,
    connectionAcquisitionTimeout: 5000,
  });

  return _driver;
}

export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const driver = getDriver();
  const session: Session = driver.session({ database: "neo4j" });

  try {
    const result: QueryResult = await session.run(cypher, params);
    return result.records.map((record) => record.toObject() as T);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AppError(`Graph query failed: ${message}`, "DB_ERROR");
  } finally {
    await session.close();
  }
}

export class AppError extends Error {
  constructor(
    message: string,
    public code: string = "UNKNOWN_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Gracefully close driver (useful for scripts/seed) */
export async function closeDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}
