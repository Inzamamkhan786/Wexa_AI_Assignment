/**
 * scripts/seed.ts
 *
 * One-shot idempotent seed script: fetches real npm dependency data from the
 * public registry API, builds the graph in memory, then writes it to CognoDB
 * using parameterised UNWIND + MERGE batches (no string-concatenated Cypher).
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires: COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD in .env.local
 */

import neo4j, { type Session } from "neo4j-driver";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

// ─── Types ────────────────────────────────────────────────────────────────────

interface NpmPkg {
  name: string;
  description?: string;
  homepage?: string;
  versions: Record<
    string,
    {
      version: string;
      deprecated?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      maintainers?: Array<{ name: string }>;
    }
  >;
  "dist-tags": { latest: string };
  time: Record<string, string>;
  maintainers?: Array<{ name: string }>;
}

interface PkgNode {
  name: string;
  description: string;
  homepage: string;
}

interface VersionNode {
  packageName: string;
  version: string;
  publishedAt: string;
  deprecated: boolean;
}

interface DependsOnRel {
  fromVersion: string; // "<name>@<version>"
  toPackage: string;
  versionRange: string;
  type: "dependency" | "devDependency" | "peerDependency";
}

interface MaintainerNode {
  username: string;
}

interface MaintainsRel {
  username: string;
  packageName: string;
}

interface VulnerabilityNode {
  id: string;
  severity: "critical" | "high" | "moderate" | "low";
  summary: string;
  cveId: string;
}

interface AffectedByRel {
  fromVersion: string; // "<name>@<version>"
  vulnId: string;
}

// ─── Seed config ─────────────────────────────────────────────────────────────

const ROOT_PACKAGES = ["express", "next", "react", "axios", "lodash", "webpack", "fastify", "koa"];

// Synthetic vulnerabilities attached to mid-tree packages to make blast-radius interesting
const SYNTHETIC_VULNERABILITIES: Array<{
  packageName: string;
  version: string;
  vuln: VulnerabilityNode;
}> = [
  {
    packageName: "lodash",
    version: "4.17.20",
    vuln: {
      id: "VULN-001",
      severity: "critical",
      summary: "Prototype pollution via _.mergeWith",
      cveId: "CVE-2020-28500",
    },
  },
  {
    packageName: "minimist",
    version: "1.2.5",
    vuln: {
      id: "VULN-002",
      severity: "critical",
      summary: "Prototype pollution in minimist",
      cveId: "CVE-2021-44906",
    },
  },
  {
    packageName: "path-to-regexp",
    version: "0.1.7",
    vuln: {
      id: "VULN-003",
      severity: "high",
      summary: "ReDoS vulnerability in path-to-regexp",
      cveId: "CVE-2024-45296",
    },
  },
  {
    packageName: "qs",
    version: "6.5.2",
    vuln: {
      id: "VULN-004",
      severity: "high",
      summary: "Prototype pollution in qs library",
      cveId: "CVE-2022-24999",
    },
  },
  {
    packageName: "body-parser",
    version: "1.19.0",
    vuln: {
      id: "VULN-005",
      severity: "moderate",
      summary: "Denial of service via large payload",
      cveId: "CVE-2024-45590",
    },
  },
];

// ─── npm registry fetch ───────────────────────────────────────────────────────

const FETCH_TIMEOUT = 10_000;
const REGISTRY = "https://registry.npmjs.org";

async function fetchPkg(name: string): Promise<NpmPkg | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(`${REGISTRY}/${encodeURIComponent(name)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`  ⚠ ${name}: HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as NpmPkg;
  } catch (err) {
    console.warn(`  ⚠ ${name}: ${err}`);
    return null;
  }
}

// ─── Graph builder ────────────────────────────────────────────────────────────

const packages = new Map<string, PkgNode>();
const versions = new Map<string, VersionNode>(); // key: "<name>@<version>"
const dependsOn: DependsOnRel[] = [];
const maintainers = new Map<string, MaintainerNode>();
const maintains: MaintainsRel[] = [];
const visitedPkgs = new Set<string>();

async function crawl(name: string, depth: number, maxDepth: number): Promise<void> {
  if (depth > maxDepth || visitedPkgs.has(name)) return;
  visitedPkgs.add(name);

  console.log(`  ${"  ".repeat(depth)}→ ${name}`);
  const data = await fetchPkg(name);
  if (!data) return;

  const latestVersion = data["dist-tags"]?.latest;
  if (!latestVersion) return;

  // Package node
  packages.set(name, {
    name,
    description: data.description ?? "",
    homepage: data.homepage ?? `https://www.npmjs.com/package/${name}`,
  });

  // Pick the latest version and a couple prior ones to seed richer data
  const versionsToProcess = [latestVersion];
  // Also pick one older version for the vulnerable packages
  const synthVuln = SYNTHETIC_VULNERABILITIES.find((sv) => sv.packageName === name);
  if (synthVuln && !versionsToProcess.includes(synthVuln.version)) {
    versionsToProcess.push(synthVuln.version);
  }

  for (const ver of versionsToProcess) {
    const vData = data.versions?.[ver];
    if (!vData) continue;

    const vKey = `${name}@${ver}`;
    versions.set(vKey, {
      packageName: name,
      version: ver,
      publishedAt: data.time?.[ver] ?? new Date().toISOString(),
      deprecated: !!vData.deprecated,
    });

    // Maintainers
    const pkgMaintainers = vData.maintainers ?? data.maintainers ?? [];
    for (const m of pkgMaintainers) {
      if (!maintainers.has(m.name)) {
        maintainers.set(m.name, { username: m.name });
      }
      maintains.push({ username: m.name, packageName: name });
    }

    // Dependencies
    const depTypes: Array<[Record<string, string> | undefined, DependsOnRel["type"]]> = [
      [vData.dependencies, "dependency"],
      [vData.devDependencies, "devDependency"],
      [vData.peerDependencies, "peerDependency"],
    ];

    for (const [deps, depType] of depTypes) {
      if (!deps) continue;
      for (const [depName, range] of Object.entries(deps)) {
        dependsOn.push({
          fromVersion: vKey,
          toPackage: depName,
          versionRange: range,
          type: depType,
        });

        // Recurse on direct + peer dependencies (not devDeps at deeper levels)
        if (depth < maxDepth && (depType === "dependency" || depth === 0)) {
          await crawl(depName, depth + 1, maxDepth);
        }
      }
    }
  }
}

// ─── Cypher write helpers ─────────────────────────────────────────────────────

async function runBatch(
  session: Session,
  cypher: string,
  params: Record<string, unknown>
): Promise<void> {
  await session.run(cypher, params);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 NPM Blast Radius — Seed Script");
  console.log("══════════════════════════════════\n");

  // ── 1. Crawl npm registry ──
  console.log("📦 Crawling npm registry (2 hops deep)…");
  for (const root of ROOT_PACKAGES) {
    await crawl(root, 0, 2);
  }

  console.log(`\n✅ Crawled ${packages.size} packages, ${versions.size} versions`);
  console.log(`   ${dependsOn.length} dependency relationships`);
  console.log(`   ${maintainers.size} unique maintainers\n`);

  // ── 2. Connect to CognoDB ──
  const uri = process.env.COGNODB_URI;
  const user = process.env.COGNODB_USER;
  const password = process.env.COGNODB_PASSWORD;

  if (!uri || !user || !password) {
    console.error("❌ Missing COGNODB_URI, COGNODB_USER, or COGNODB_PASSWORD in .env.local");
    process.exit(1);
  }

  console.log("🔌 Connecting to CognoDB…");
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

  try {
    await driver.verifyConnectivity();
    console.log("✅ Connected\n");
  } catch (err) {
    console.error("❌ Connection failed:", err);
    await driver.close();
    process.exit(1);
  }

  const session = driver.session({ database: "neo4j" });

  try {
    // ── 3. Create indexes ──
    console.log("📐 Creating indexes…");
    const indexes = [
      "CREATE INDEX pkg_name IF NOT EXISTS FOR (p:Package) ON (p.name)",
      "CREATE INDEX ver_key IF NOT EXISTS FOR (v:Version) ON (v.version)",
      "CREATE INDEX vuln_id IF NOT EXISTS FOR (v:Vulnerability) ON (v.id)",
      "CREATE INDEX maint_username IF NOT EXISTS FOR (m:Maintainer) ON (m.username)",
    ];
    for (const idx of indexes) {
      await session.run(idx);
    }
    console.log("✅ Indexes ready\n");

    // ── 4. Upsert Package nodes ──
    console.log(`📦 Writing ${packages.size} Package nodes…`);
    const pkgBatches = chunk([...packages.values()], 200);
    for (const batch of pkgBatches) {
      await runBatch(session,
        `UNWIND $batch AS p
         MERGE (pkg:Package {name: p.name})
         SET pkg.description = p.description,
             pkg.homepage    = p.homepage`,
        { batch }
      );
    }

    // ── 5. Upsert Version nodes + HAS_VERSION ──
    console.log(`🔢 Writing ${versions.size} Version nodes…`);
    const verList = [...versions.values()];
    const verBatches = chunk(verList, 200);
    for (const batch of verBatches) {
      await runBatch(session,
        `UNWIND $batch AS v
         MERGE (ver:Version {version: v.version, packageName: v.packageName})
         SET ver.publishedAt = v.publishedAt,
             ver.deprecated  = v.deprecated
         WITH ver, v
         MATCH (pkg:Package {name: v.packageName})
         MERGE (pkg)-[:HAS_VERSION]->(ver)`,
        { batch }
      );
    }

    // ── 6. DEPENDS_ON relationships ──
    // Only keep deps whose target package is in our graph
    const knownPackages = new Set(packages.keys());
    const filteredDeps = dependsOn.filter((d) => knownPackages.has(d.toPackage));
    console.log(`🔗 Writing ${filteredDeps.length} DEPENDS_ON relationships…`);
    const depBatches = chunk(filteredDeps, 200);
    for (const batch of depBatches) {
      await runBatch(session,
        `UNWIND $batch AS d
         MATCH (ver:Version {version: split(d.fromVersion,'@')[1], packageName: split(d.fromVersion,'@')[0]})
         MATCH (pkg:Package {name: d.toPackage})
         MERGE (ver)-[r:DEPENDS_ON {toPackage: d.toPackage}]->(pkg)
         SET r.versionRange = d.versionRange,
             r.type         = d.type`,
        { batch }
      );
    }

    // ── 7. Maintainers ──
    const uniqueMaintains = dedupeRels(maintains);
    console.log(`👤 Writing ${maintainers.size} Maintainer nodes…`);
    const mBatches = chunk([...maintainers.values()], 200);
    for (const batch of mBatches) {
      await runBatch(session,
        `UNWIND $batch AS m
         MERGE (maint:Maintainer {username: m.username})`,
        { batch }
      );
    }
    const mrBatches = chunk(uniqueMaintains, 200);
    for (const batch of mrBatches) {
      await runBatch(session,
        `UNWIND $batch AS rel
         MATCH (m:Maintainer {username: rel.username})
         MATCH (p:Package {name: rel.packageName})
         MERGE (m)-[:MAINTAINS]->(p)`,
        { batch }
      );
    }

    // ── 8. Synthetic vulnerabilities ──
    console.log(`🛡  Writing ${SYNTHETIC_VULNERABILITIES.length} synthetic Vulnerability nodes…`);
    for (const sv of SYNTHETIC_VULNERABILITIES) {
      await session.run(
        `MERGE (v:Vulnerability {id: $id})
         SET v.severity = $severity,
             v.summary  = $summary,
             v.cveId    = $cveId
         WITH v
         MATCH (ver:Version {version: $version, packageName: $pkgName})
         MERGE (ver)-[:AFFECTED_BY]->(v)`,
        {
          id: sv.vuln.id,
          severity: sv.vuln.severity,
          summary: sv.vuln.summary,
          cveId: sv.vuln.cveId,
          version: sv.version,
          pkgName: sv.packageName,
        }
      );
    }

    // ── 9. LATEST shortcut ──
    console.log("⚡ Setting LATEST pointers…");
    await session.run(`
      MATCH (p:Package)-[:HAS_VERSION]->(v:Version)
      WITH p, v ORDER BY v.publishedAt DESC
      WITH p, collect(v)[0] AS latest
      MERGE (p)-[:LATEST]->(latest)
    `);

    console.log("\n🎉 Seed complete!\n");
    console.log("Graph summary:");

    const summary = await session.run(`
      MATCH (p:Package) WITH count(p) AS pkgs
      MATCH (v:Version) WITH pkgs, count(v) AS vers
      MATCH ()-[r:DEPENDS_ON]->() WITH pkgs, vers, count(r) AS deps
      MATCH (vuln:Vulnerability) WITH pkgs, vers, deps, count(vuln) AS vulns
      RETURN pkgs, vers, deps, vulns
    `);
    const s = summary.records[0];
    console.log(`  Packages:        ${s.get("pkgs")}`);
    console.log(`  Versions:        ${s.get("vers")}`);
    console.log(`  Dependencies:    ${s.get("deps")}`);
    console.log(`  Vulnerabilities: ${s.get("vulns")}`);
  } finally {
    await session.close();
    await driver.close();
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function dedupeRels(rels: MaintainsRel[]): MaintainsRel[] {
  const seen = new Set<string>();
  return rels.filter((r) => {
    const key = `${r.username}::${r.packageName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
