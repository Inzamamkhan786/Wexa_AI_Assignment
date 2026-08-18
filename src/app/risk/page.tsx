"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, AlertTriangle, Shield, RefreshCw } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PageLoader } from "@/components/LoadingStates";
import { useRouter } from "next/navigation";

interface RiskEntry {
  name: string;
  description: string;
  dependentCount: number;
  hasVulnerability: boolean;
  vulnerabilities: Array<{
    id: string;
    severity: "critical" | "high" | "moderate" | "low";
    summary: string;
    cveId: string;
  }>;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, moderate: 2, low: 1 };

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  moderate: "#f59e0b",
  low: "#10b981",
};

export default function RiskPage() {
  const router = useRouter();
  const [data, setData] = useState<RiskEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/risk-ranking?limit=20");
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

  const maxCount = data ? Math.max(...data.map((d) => d.dependentCount), 1) : 1;
  const topSeverity = (entry: RiskEntry) =>
    entry.vulnerabilities.reduce(
      (max, v) => (SEVERITY_ORDER[v.severity] > SEVERITY_ORDER[max] ? v.severity : max),
      "low" as string
    );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <BarChart3 size={20} color="#f59e0b" />
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>Risk Ranking</h1>
          </div>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
            The packages with the most upstream dependents — a compromise here would cascade the furthest
          </p>
        </div>
        <button className="btn-secondary" onClick={fetchData} disabled={loading}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* "Why this matters" callout */}
      <div
        className="glass-card"
        style={{
          padding: "16px 20px",
          marginBottom: 28,
          background: "rgba(245,158,11,0.05)",
          borderColor: "rgba(245,158,11,0.2)",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <TrendingUp size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "#f59e0b" }}>
            Why this is hard in SQL
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>
            Counting <em>all transitive dependents</em> of every package in a relational DB requires
            recursive CTEs with multiple self-joins — extremely slow at scale. In CognoDB, this is a
            single native traversal with <code style={{ fontFamily: "var(--font-mono)", color: "#a78bfa" }}>
              MATCH (dep)&lt;-[:DEPENDS_ON*]-() RETURN dep, count(*)
            </code>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 24 }}>
          <ErrorBanner message={error.message} code={error.code} onRetry={fetchData} />
        </div>
      )}

      {loading && <PageLoader />}

      {!loading && data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.length === 0 ? (
            <div className="glass-card" style={{ padding: 48, textAlign: "center", color: "#475569" }}>
              <BarChart3 size={32} style={{ margin: "0 auto 12px", color: "#334155" }} />
              No data yet — run the seed script first
            </div>
          ) : (
            data.map((entry, i) => {
              const pct = Math.round((entry.dependentCount / maxCount) * 100);
              const isDangerous = entry.hasVulnerability;
              const severity = isDangerous ? topSeverity(entry) : null;

              return (
                <div
                  key={entry.name}
                  className="glass-card animate-fade-in-up"
                  style={{
                    padding: "18px 22px",
                    border: isDangerous ? "1px solid rgba(239,68,68,0.25)" : undefined,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onClick={() => router.push(`/blast-radius?name=${encodeURIComponent(entry.name)}`)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
                    {/* Rank */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background:
                          i === 0
                            ? "linear-gradient(135deg, #f59e0b, #d97706)"
                            : i === 1
                            ? "rgba(148,163,184,0.2)"
                            : i === 2
                            ? "rgba(180,120,60,0.25)"
                            : "rgba(255,255,255,0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: i < 3 ? "#f1f5f9" : "#64748b",
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>

                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>
                          {entry.name}
                        </span>
                        {isDangerous && severity && (
                          <span
                            className={`badge badge-${severity}`}
                            style={{ display: "inline-flex", alignItems: "center", gap: 3 }}
                          >
                            <AlertTriangle size={9} />
                            {severity} vuln
                          </span>
                        )}
                        {!isDangerous && (
                          <span style={{ fontSize: 10, color: "#10b981", display: "flex", alignItems: "center", gap: 3 }}>
                            <Shield size={9} /> clean
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.description || "No description"}
                      </div>
                    </div>

                    {/* Count */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: isDangerous ? "#ef4444" : "#6366f1", lineHeight: 1 }}>
                        {entry.dependentCount}
                      </div>
                      <div style={{ fontSize: 10, color: "#475569" }}>dependents</div>
                    </div>
                  </div>

                  {/* Risk bar */}
                  <div className="risk-bar-track">
                    <div
                      className={`risk-bar-fill ${isDangerous ? "danger" : ""}`}
                      style={{
                        width: `${pct}%`,
                        background: isDangerous
                          ? `linear-gradient(90deg, ${SEVERITY_COLOR[severity ?? "low"]}, #f97316)`
                          : undefined,
                      }}
                    />
                  </div>

                  {/* Vulnerabilities detail */}
                  {isDangerous && entry.vulnerabilities.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {entry.vulnerabilities.slice(0, 3).map((v) => (
                        <div
                          key={v.id}
                          style={{
                            fontSize: 11,
                            color: "#94a3b8",
                            background: "rgba(239,68,68,0.06)",
                            border: "1px solid rgba(239,68,68,0.12)",
                            borderRadius: 6,
                            padding: "3px 8px",
                          }}
                        >
                          {v.cveId || v.id}: {v.summary.slice(0, 50)}{v.summary.length > 50 ? "…" : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
