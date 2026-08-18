"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Zap, ChevronRight, AlertTriangle, Shield } from "lucide-react";
import { DependencyGraph } from "@/components/DependencyGraph";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PageLoader, LoadingSpinner } from "@/components/LoadingStates";
import type { GraphData } from "@/lib/queries";

interface BlastResult {
  affectedRoot: string;
  pathLength: number;
  pathNodes: string[];
  vulnerability?: {
    id: string;
    severity: "critical" | "high" | "moderate" | "low";
    summary: string;
    cveId: string;
  };
}

interface BlastData {
  results: BlastResult[];
  graphData: GraphData;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: "badge-critical",
  high: "badge-high",
  moderate: "badge-moderate",
  low: "badge-low",
};

function BlastRadiusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialName = searchParams.get("name") ?? "";

  const [inputValue, setInputValue] = useState(initialName);
  const [packageName, setPackageName] = useState(initialName);
  const [data, setData] = useState<BlastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [highlightPath, setHighlightPath] = useState<string[] | null>(null);

  useEffect(() => {
    if (packageName) fetchBlastRadius(packageName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageName]);

  async function fetchBlastRadius(name: string) {
    setLoading(true);
    setError(null);
    setData(null);
    setHighlightPath(null);

    try {
      const res = await fetch(`/api/blast-radius?name=${encodeURIComponent(name)}`);
      const json = await res.json();
      if (!res.ok) {
        setError({ message: json.error, code: json.code });
      } else {
        setData(json);
      }
    } catch {
      setError({ message: "Failed to connect to the server.", code: "DB_ERROR" });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    router.push(`/blast-radius?name=${encodeURIComponent(trimmed)}`);
    setPackageName(trimmed);
  }

  const highlightSet = highlightPath ? new Set(highlightPath.map((n) => `pkg:${n}`)) : undefined;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Zap size={20} color="#ef4444" />
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Blast Radius Analyzer</h1>
        </div>
        <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
          Given a vulnerable package, find every root app affected and the path through which it's reached
        </p>
      </div>

      {/* Controls */}
      <div className="glass-card" style={{ padding: "20px 24px", marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>
            Vulnerable / target package
          </label>
          <input
            id="blast-input"
            className="input-primary"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="e.g. lodash"
          />
        </div>
        <button
          id="blast-btn"
          className="btn-danger"
          style={{ padding: "12px 24px" }}
          onClick={handleSubmit}
          disabled={loading || !inputValue.trim()}
        >
          {loading ? <LoadingSpinner size={14} label="" /> : <Zap size={14} />}
          Analyze
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 24 }}>
          <ErrorBanner
            message={error.message}
            code={error.code}
            onRetry={() => fetchBlastRadius(packageName)}
          />
        </div>
      )}

      {loading && <PageLoader />}

      {!loading && data && (
        <>
          {/* Summary banner */}
          <div
            style={{
              background: data.results.length > 0 ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
              border: `1px solid ${data.results.length > 0 ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`,
              borderRadius: 14,
              padding: "16px 24px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            {data.results.length > 0 ? (
              <AlertTriangle size={22} color="#ef4444" />
            ) : (
              <Shield size={22} color="#10b981" />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: data.results.length > 0 ? "#ef4444" : "#10b981" }}>
                {data.results.length > 0
                  ? `${data.results.length} root package${data.results.length > 1 ? "s" : ""} affected`
                  : "No affected packages found"}
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
                {data.results.length > 0
                  ? `A compromise of "${packageName}" would impact ${data.results.length} upstream package${data.results.length > 1 ? "s" : ""}`
                  : `"${packageName}" has no dependents in the graph`}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
            {/* Graph */}
            <div>
              <DependencyGraph
                data={data.graphData}
                highlightNodes={highlightSet}
                height={500}
              />
              {highlightPath && (
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  {highlightPath.map((node, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center" }}>
                      <span
                        className={`path-node ${node === packageName ? "active" : ""}`}
                      >
                        {node}
                      </span>
                      {i < highlightPath.length - 1 && (
                        <span className="path-arrow">→</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Results list */}
            <div
              className="glass-card"
              style={{ padding: "16px 20px", maxHeight: 560, overflowY: "auto" }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: "#94a3b8", marginBottom: 14 }}>
                AFFECTED PACKAGES
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.results.length === 0 ? (
                  <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
                    No affected packages
                  </div>
                ) : (
                  data.results.map((result, i) => (
                    <div
                      key={i}
                      className="glass-card"
                      style={{
                        padding: "14px 16px",
                        cursor: "pointer",
                        border: highlightPath === result.pathNodes ? "1px solid rgba(239,68,68,0.4)" : undefined,
                        transition: "all 0.2s",
                      }}
                      onClick={() => setHighlightPath(result.pathNodes)}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#f1f5f9" }}>
                          {result.affectedRoot}
                        </div>
                        <span style={{ fontSize: 11, color: "#475569" }}>
                          {result.pathLength} hop{result.pathLength > 1 ? "s" : ""}
                        </span>
                      </div>

                      {result.vulnerability && (
                        <div style={{ marginBottom: 8 }}>
                          <span className={`badge ${SEVERITY_BADGE[result.vulnerability.severity]}`}>
                            {result.vulnerability.severity}
                          </span>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, lineHeight: 1.5 }}>
                            {result.vulnerability.summary}
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                        {result.pathNodes.slice(0, 4).map((node, j) => (
                          <span key={j} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "var(--font-mono)",
                                color: node === packageName ? "#ef4444" : "#64748b",
                                background: node === packageName ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}
                            >
                              {node}
                            </span>
                            {j < Math.min(result.pathNodes.length, 4) - 1 && (
                              <ChevronRight size={9} color="#475569" />
                            )}
                          </span>
                        ))}
                        {result.pathNodes.length > 4 && (
                          <span style={{ fontSize: 10, color: "#475569" }}>
                            +{result.pathNodes.length - 4} more
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <button
                          className="btn-secondary"
                          style={{ fontSize: 11, padding: "5px 10px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/explore?name=${encodeURIComponent(result.affectedRoot)}`);
                          }}
                        >
                          Explore →
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !data && !error && (
        <div className="glass-card" style={{ padding: 48, textAlign: "center", color: "#475569" }}>
          <Zap size={32} style={{ margin: "0 auto 12px", color: "#334155" }} />
          Enter a package name to analyze its blast radius
        </div>
      )}
    </div>
  );
}

export default function BlastRadiusPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <BlastRadiusContent />
    </Suspense>
  );
}
