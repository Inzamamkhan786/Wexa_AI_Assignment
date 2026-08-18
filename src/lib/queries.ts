/**
 * lib/queries.ts
 * All Cypher queries — fully parameterised, no string concatenation.
 */
import { runQuery, AppError } from "./db";
import neo4j, { Integer } from "neo4j-driver";

// ---------- Types ----------

export interface PackageNode {
  name: string;
  description: string;
  homepage: string;
}

export interface VersionNode {
  version: string;
  publishedAt: string;
  deprecated: boolean;
}

export interface VulnerabilityNode {
  id: string;
  severity: "critical" | "high" | "moderate" | "low";
  summary: string;
  cveId: string;
}

export interface MaintainerNode {
  username: string;
}

export type NodeType = "root" | "package" | "deprecated" | "target" | "vulnerability";

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  data: Record<string, unknown>;
}

export interface GraphLink {
  source: string;
  target: string;
  type: string;
  versionRange?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ---------- Query 1: Multi-hop dependency traversal ----------

export async function getDependencyTree(
  packageName: string,
  hops: number = 4
): Promise<GraphData> {
  // Guard hops to a safe range
  const safeHops = Math.max(1, Math.min(hops, 6));

  const cypher = `
    MATCH (root:Package {name: $name})-[:HAS_VERSION]->(rv:Version)
    WITH root, rv ORDER BY rv.publishedAt DESC LIMIT 1
    MATCH path = (rv)-[:DEPENDS_ON*0..${safeHops}]->(dep:Package)-[:HAS_VERSION]->(dv:Version)
    WITH root, rv, dep, dv,
         relationships(path) AS rels,
         nodes(path) AS pathNodes
    RETURN DISTINCT
      root.name AS rootName,
      rv.version AS rootVersion,
      dep.name AS depName,
      dep.description AS depDesc,
      dv.version AS depVersion,
      dv.deprecated AS depDeprecated,
      [r IN rels | {type: type(r), range: r.versionRange}] AS relChain
    ORDER BY dep.name
  `;

  const rows = await runQuery(cypher, { name: packageName });

  if (rows.length === 0) {
    throw new AppError(`Package "${packageName}" not found in graph.`, "NOT_FOUND");
  }

  const nodeMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  // Add root package
  const firstRow = rows[0] as Record<string, unknown>;
  const rootId = `pkg:${firstRow.rootName}`;
  nodeMap.set(rootId, {
    id: rootId,
    label: String(firstRow.rootName),
    type: "root",
    data: { version: firstRow.rootVersion },
  });

  for (const row of rows as Record<string, unknown>[]) {
    const depId = `pkg:${row.depName}`;
    const depType: NodeType = row.depDeprecated ? "deprecated" : "package";
    if (!nodeMap.has(depId)) {
      nodeMap.set(depId, {
        id: depId,
        label: String(row.depName),
        type: depType,
        data: { version: row.depVersion, description: row.depDesc },
      });
    }
    const relChain = row.relChain as Array<{ type: string; range: string }>;
    if (relChain?.length > 0) {
      links.push({
        source: rootId,
        target: depId,
        type: relChain[relChain.length - 1]?.type ?? "DEPENDS_ON",
        versionRange: relChain[relChain.length - 1]?.range,
      });
    }
  }

  return { nodes: [...nodeMap.values()], links };
}

// ---------- Query 2: Blast radius — given a package, who depends on it ----------

export interface BlastRadiusResult {
  affectedRoot: string;
  pathLength: number;
  pathNodes: string[];
  vulnerability?: VulnerabilityNode;
}

export async function getBlastRadius(
  targetPackage: string,
  hops: number = 6
): Promise<{ results: BlastRadiusResult[]; graphData: GraphData }> {
  const safeHops = Math.max(1, Math.min(hops, 8));

  const cypher = `
    MATCH path = (root:Package)-[:HAS_VERSION]->(:Version)-[:DEPENDS_ON*1..${safeHops}]->(target:Package {name: $name})
    OPTIONAL MATCH (target)-[:HAS_VERSION]->(:Version)-[:AFFECTED_BY]->(vuln:Vulnerability)
    RETURN DISTINCT
      root.name AS rootName,
      length(path) AS pathLen,
      [n IN nodes(path) WHERE n:Package | n.name] AS pkgPath,
      vuln.id AS vulnId,
      vuln.severity AS vulnSeverity,
      vuln.summary AS vulnSummary,
      vuln.cveId AS vulnCveId
    ORDER BY pathLen ASC
  `;

  const rows = await runQuery(cypher, { name: targetPackage });

  const nodeMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const results: BlastRadiusResult[] = [];

  for (const row of rows as Record<string, unknown>[]) {
    const pathNodes = row.pkgPath as string[];
    results.push({
      affectedRoot: String(row.rootName),
      pathLength: neo4j.integer.toNumber(row.pathLen as Integer),
      pathNodes,
      vulnerability: row.vulnId
        ? {
            id: String(row.vulnId),
            severity: row.vulnSeverity as VulnerabilityNode["severity"],
            summary: String(row.vulnSummary),
            cveId: String(row.vulnCveId),
          }
        : undefined,
    });

    // Build graph nodes & links
    for (let i = 0; i < pathNodes.length; i++) {
      const id = `pkg:${pathNodes[i]}`;
      if (!nodeMap.has(id)) {
        const nodeType: NodeType =
          pathNodes[i] === targetPackage ? "target" : i === 0 ? "root" : "package";
        nodeMap.set(id, {
          id,
          label: pathNodes[i],
          type: nodeType,
          data: {},
        });
      }
      if (i > 0) {
        links.push({
          source: `pkg:${pathNodes[i - 1]}`,
          target: `pkg:${pathNodes[i]}`,
          type: "DEPENDS_ON",
        });
      }
    }
  }

  return {
    results,
    graphData: { nodes: [...nodeMap.values()], links },
  };
}

// ---------- Query 3: Shortest path between two packages ----------

export interface ShortestPathResult {
  pathNodes: string[];
  length: number;
}

export async function getShortestPath(
  fromPackage: string,
  toPackage: string
): Promise<ShortestPathResult | null> {
  const cypher = `
    MATCH (a:Package {name: $from}), (b:Package {name: $to})
    MATCH path = shortestPath(
      (a)-[:HAS_VERSION|DEPENDS_ON*..12]-(b)
    )
    RETURN [n IN nodes(path) WHERE n:Package | n.name] AS pkgPath,
           length(path) AS pathLen
    LIMIT 1
  `;

  const rows = await runQuery<Record<string, unknown>>(cypher, {
    from: fromPackage,
    to: toPackage,
  });

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    pathNodes: row.pkgPath as string[],
    length: neo4j.integer.toNumber(row.pathLen as Integer),
  };
}

// ---------- Query 4: Riskiest packages (centrality-ish) ----------

export interface RiskRankEntry {
  name: string;
  description: string;
  dependentCount: number;
  hasVulnerability: boolean;
  vulnerabilities: VulnerabilityNode[];
}

export async function getRiskRanking(limit: number = 15): Promise<RiskRankEntry[]> {
  const cypher = `
    MATCH (dep:Package)<-[:DEPENDS_ON]-(:Version)<-[:HAS_VERSION]-(dependant:Package)
    WITH dep, count(DISTINCT dependant) AS dependantCount
    OPTIONAL MATCH (dep)-[:HAS_VERSION]->(:Version)-[:AFFECTED_BY]->(v:Vulnerability)
    RETURN dep.name AS name,
           dep.description AS description,
           dependantCount,
           collect(DISTINCT {
             id: v.id,
             severity: v.severity,
             summary: v.summary,
             cveId: v.cveId
           }) AS vulns
    ORDER BY dependantCount DESC
    LIMIT $limit
  `;

  const rows = await runQuery<Record<string, unknown>>(cypher, {
    limit: neo4j.int(limit),
  });

  return rows.map((row) => {
    const vulns = (row.vulns as Array<Record<string, unknown>>).filter(
      (v) => v.id !== null
    );
    return {
      name: String(row.name),
      description: String(row.description ?? ""),
      dependentCount: neo4j.integer.toNumber(row.dependantCount as Integer),
      hasVulnerability: vulns.length > 0,
      vulnerabilities: vulns as unknown as VulnerabilityNode[],
    };
  });
}

// ---------- Query 5: Shared dependencies between two packages ----------

export interface SharedDepResult {
  sharedPackage: string;
  description: string;
  leftVersion: string;
  rightVersion: string;
  versionConflict: boolean;
}

export async function getSharedDependencies(
  pkgA: string,
  pkgB: string
): Promise<SharedDepResult[]> {
  const cypher = `
    MATCH (a:Package {name: $pkgA})-[:HAS_VERSION]->(av:Version)-[:DEPENDS_ON*1..4]->(shared:Package)
    MATCH (b:Package {name: $pkgB})-[:HAS_VERSION]->(bv:Version)-[:DEPENDS_ON*1..4]->(shared)
    MATCH (shared)-[:HAS_VERSION]->(sv:Version)
    WITH shared, av.version AS leftVer, bv.version AS rightVer,
         collect(DISTINCT sv.version) AS sharedVersions
    RETURN DISTINCT
      shared.name AS sharedPkg,
      shared.description AS sharedDesc,
      leftVer,
      rightVer,
      sharedVersions[0] AS sharedVer,
      leftVer <> rightVer AS hasConflict
    ORDER BY shared.name
  `;

  const rows = await runQuery<Record<string, unknown>>(cypher, { pkgA, pkgB });

  return rows.map((row) => ({
    sharedPackage: String(row.sharedPkg),
    description: String(row.sharedDesc ?? ""),
    leftVersion: String(row.leftVer ?? ""),
    rightVersion: String(row.rightVer ?? ""),
    versionConflict: Boolean(row.hasConflict),
  }));
}

// ---------- Query 6: Package info ----------

export interface PackageInfo {
  name: string;
  description: string;
  homepage: string;
  latestVersion: string;
  publishedAt: string;
  deprecated: boolean;
  maintainers: string[];
  vulnerabilities: VulnerabilityNode[];
}

export async function getPackageInfo(packageName: string): Promise<PackageInfo | null> {
  const cypher = `
    MATCH (p:Package {name: $name})
    OPTIONAL MATCH (p)-[:HAS_VERSION]->(v:Version)
    WITH p, v ORDER BY v.publishedAt DESC
    WITH p, collect(v)[0] AS latest
    OPTIONAL MATCH (m:Maintainer)-[:MAINTAINS]->(p)
    OPTIONAL MATCH (latest)-[:AFFECTED_BY]->(vuln:Vulnerability)
    RETURN
      p.name AS name,
      p.description AS description,
      p.homepage AS homepage,
      latest.version AS latestVersion,
      latest.publishedAt AS publishedAt,
      latest.deprecated AS deprecated,
      collect(DISTINCT m.username) AS maintainers,
      collect(DISTINCT {
        id: vuln.id,
        severity: vuln.severity,
        summary: vuln.summary,
        cveId: vuln.cveId
      }) AS vulns
  `;

  const rows = await runQuery<Record<string, unknown>>(cypher, { name: packageName });
  if (rows.length === 0 || !rows[0].name) return null;

  const row = rows[0];
  const vulns = (row.vulns as Array<Record<string, unknown>>).filter((v) => v.id !== null);

  return {
    name: String(row.name),
    description: String(row.description ?? ""),
    homepage: String(row.homepage ?? ""),
    latestVersion: String(row.latestVersion ?? ""),
    publishedAt: String(row.publishedAt ?? ""),
    deprecated: Boolean(row.deprecated),
    maintainers: row.maintainers as string[],
    vulnerabilities: vulns as unknown as VulnerabilityNode[],
  };
}

// ---------- Search packages ----------
export async function searchPackages(query: string, limit = 10): Promise<PackageNode[]> {
  const cypher = `
    MATCH (p:Package)
    WHERE toLower(p.name) CONTAINS toLower($q)
    RETURN p.name AS name, p.description AS description, p.homepage AS homepage
    ORDER BY p.name
    LIMIT $limit
  `;
  const rows = await runQuery<Record<string, unknown>>(cypher, {
    q: query,
    limit: neo4j.int(limit),
  });
  return rows.map((r) => ({
    name: String(r.name),
    description: String(r.description ?? ""),
    homepage: String(r.homepage ?? ""),
  }));
}
