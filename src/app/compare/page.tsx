"use client";

import { useState, Suspense } from "react";
import { ArrowLeftRight, CheckCircle, XCircle, GitMerge } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PageLoader, LoadingSpinner } from "@/components/LoadingStates";

interface SharedDep {
  sharedPackage: string;
  description: string;
  leftVersion: string;
  rightVersion: string;
  versionConflict: boolean;
}

interface ShortestPathResult {
  pathNodes: string[];
  length: number;
}

function CompareContent() {
  const [pkgA, setPkgA] = useState("");
  const [pkgB, setPkgB] = useState("");
  const [sharedDeps, setSharedDeps] = useState<SharedDep[] | null>(null);
  const [shortestPath, setShortestPath] = useState<ShortestPathResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  async function handleCompare() {
    if (!pkgA.trim() || !pkgB.trim()) return;
    setLoading(true);
    setError(null);
    setSharedDeps(null);
    setShortestPath(null);

    try {
      const [sharedRes, pathRes] = await Promise.all([
        fetch(`/api/compare?a=${encodeURIComponent(pkgA.trim())}&b=${encodeURIComponent(pkgB.trim())}`),
        fetch(`/api/shortest-path?from=${encodeURIComponent(pkgA.trim())}&to=${encodeURIComponent(pkgB.trim())}`),
      ]);

      const sharedData = await sharedRes.json();
      const pathData = await pathRes.json();

      if (!sharedRes.ok) {
        setError({ message: sharedData.error, code: sharedData.code });
      } else {
        setSharedDeps(sharedData);
      }

      if (pathRes.ok) {
        setShortestPath(pathData);
      }
    } catch {
      setError({ message: "Failed to connect to the server.", code: "DB_ERROR" });
    } finally {
      setLoading(false);
    }
  }

  const conflicts = sharedDeps?.filter((d) => d.versionConflict) ?? [];
  const safe = sharedDeps?.filter((d) => !d.versionConflict) ?? [];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <ArrowLeftRight size={20} color="#10b981" />
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Package Comparator</h1>
        </div>
        <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
          Find shared dependencies, version conflicts, and the shortest dependency path between two packages
        </p>
      </div>

      {/* Controls */}
      <div className="glass-card" style={{ padding: "24px", marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>
              Package A
            </label>
            <input
              id="compare-a"
              className="input-primary"
              value={pkgA}
              onChange={(e) => setPkgA(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCompare()}
              placeholder="e.g. express"
            />
          </div>

          <div
            style={{
              width: 36,
              height: 36,
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginBottom: 2,
            }}
          >
            <ArrowLeftRight size={14} color="#10b981" />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>
              Package B
            </label>
            <input
              id="compare-b"
              className="input-primary"
              value={pkgB}
              onChange={(e) => setPkgB(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCompare()}
              placeholder="e.g. fastify"
            />
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <button
            id="compare-btn"
            className="btn-primary"
            onClick={handleCompare}
            disabled={loading || !pkgA.trim() || !pkgB.trim()}
          >
            {loading ? <LoadingSpinner size={14} label="" /> : <GitMerge size={14} />}
            Compare Packages
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 24 }}>
          <ErrorBanner message={error.message} code={error.code} onRetry={handleCompare} />
        </div>
      )}

      {loading && <PageLoader />}

      {!loading && sharedDeps && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Shortest path */}
          {shortestPath && (
            <div className="glass-card" style={{ padding: "20px 24px" }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: "#94a3b8" }}>
                SHORTEST PATH ({shortestPath.length} hops)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                {shortestPath.pathNodes.map((node, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      className="path-node"
                      style={{
                        borderColor: (node === pkgA || node === pkgB) ? "rgba(16,185,129,0.4)" : undefined,
                        color: (node === pkgA || node === pkgB) ? "#10b981" : undefined,
                        background: (node === pkgA || node === pkgB) ? "rgba(16,185,129,0.1)" : undefined,
                      }}
                    >
                      {node}
                    </span>
                    {i < shortestPath.pathNodes.length - 1 && (
                      <span className="path-arrow">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!shortestPath && (
            <div className="glass-card" style={{ padding: "16px 20px", borderColor: "rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)" }}>
              <div style={{ fontSize: 13, color: "#f59e0b" }}>
                No direct or indirect dependency path found between these two packages.
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {[
              { label: "Shared Dependencies", value: sharedDeps.length, color: "#6366f1" },
              { label: "Version Conflicts", value: conflicts.length, color: conflicts.length > 0 ? "#ef4444" : "#10b981" },
              { label: "Compatible Deps", value: safe.length, color: "#10b981" },
            ].map((s) => (
              <div className="stat-card" key={s.label}>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Conflicts first */}
          {conflicts.length > 0 && (
            <div className="glass-card" style={{ padding: "20px 24px" }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: "#ef4444" }}>
                ⚠ VERSION CONFLICTS ({conflicts.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {conflicts.map((dep) => (
                  <SharedDepRow key={dep.sharedPackage} dep={dep} pkgA={pkgA} pkgB={pkgB} conflict />
                ))}
              </div>
            </div>
          )}

          {/* Compatible */}
          {safe.length > 0 && (
            <div className="glass-card" style={{ padding: "20px 24px" }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: "#10b981" }}>
                ✓ COMPATIBLE SHARED DEPENDENCIES ({safe.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {safe.map((dep) => (
                  <SharedDepRow key={dep.sharedPackage} dep={dep} pkgA={pkgA} pkgB={pkgB} conflict={false} />
                ))}
              </div>
            </div>
          )}

          {sharedDeps.length === 0 && (
            <div className="glass-card" style={{ padding: 48, textAlign: "center", color: "#475569" }}>
              <GitMerge size={32} style={{ margin: "0 auto 12px", color: "#334155" }} />
              No shared dependencies found between these packages
            </div>
          )}
        </div>
      )}

      {!loading && !sharedDeps && !error && (
        <div className="glass-card" style={{ padding: 48, textAlign: "center", color: "#475569" }}>
          <ArrowLeftRight size={32} style={{ margin: "0 auto 12px", color: "#334155" }} />
          Enter two package names to compare
        </div>
      )}
    </div>
  );
}

function SharedDepRow({
  dep,
  pkgA,
  pkgB,
  conflict,
}: {
  dep: SharedDep;
  pkgA: string;
  pkgB: string;
  conflict: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
        background: conflict ? "rgba(239,68,68,0.04)" : "rgba(16,185,129,0.04)",
        border: `1px solid ${conflict ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)"}`,
        borderRadius: 10,
      }}
    >
      {conflict ? (
        <XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
      ) : (
        <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#f1f5f9", marginBottom: 2 }}>
          {dep.sharedPackage}
        </div>
        {dep.description && (
          <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {dep.description}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#475569" }}>{pkgA}</div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#94a3b8" }}>
            {dep.leftVersion || "any"}
          </div>
        </div>
        <div style={{ color: conflict ? "#ef4444" : "#10b981", fontSize: 12 }}>vs</div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 10, color: "#475569" }}>{pkgB}</div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#94a3b8" }}>
            {dep.rightVersion || "any"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CompareContent />
    </Suspense>
  );
}
