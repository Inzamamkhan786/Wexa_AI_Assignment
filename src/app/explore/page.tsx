"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GitBranch, Package, ChevronRight, ExternalLink, AlertTriangle } from "lucide-react";
import { DependencyGraph } from "@/components/DependencyGraph";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PageLoader, LoadingSpinner } from "@/components/LoadingStates";
import type { GraphData, GraphNode } from "@/lib/queries";

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialName = searchParams.get("name") ?? "";

  const [packageName, setPackageName] = useState(initialName);
  const [inputValue, setInputValue] = useState(initialName);
  const [hops, setHops] = useState(4);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (packageName) fetchGraph(packageName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageName, hops]);

  async function fetchGraph(name: string) {
    setLoading(true);
    setError(null);
    setGraph(null);

    try {
      const res = await fetch(
        `/api/dependencies?name=${encodeURIComponent(name)}&hops=${hops}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError({ message: data.error, code: data.code });
      } else {
        setGraph(data as GraphData);
      }
    } catch {
      setError({ message: "Failed to connect to the server.", code: "DB_ERROR" });
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    router.push(`/explore?name=${encodeURIComponent(trimmed)}`);
    setPackageName(trimmed);
  }

  const stats = graph
    ? {
        total: graph.nodes.length,
        deprecated: graph.nodes.filter((n) => n.type === "deprecated").length,
        links: graph.links.length,
      }
    : null;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <GitBranch size={20} color="#6366f1" />
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Dependency Explorer</h1>
        </div>
        <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
          Visualize the full transitive dependency tree as an interactive graph
        </p>
      </div>

      {/* Controls */}
      <div
        className="minimal-card"
        style={{ padding: "20px 24px", marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 6 }}>
            Package name
          </label>
          <input
            id="explore-input"
            className="input-primary"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. express"
          />
        </div>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 6 }}>
            Max hops (depth)
          </label>
          <select
            id="hops-select"
            value={hops}
            onChange={(e) => setHops(parseInt(e.target.value))}
            className="input-primary"
            style={{ cursor: "pointer" }}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n} style={{ background: "#ffffff" }}>
                {n} hop{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          id="explore-btn"
          className="btn-primary"
          onClick={handleSearch}
          disabled={loading || !inputValue.trim()}
        >
          {loading ? <LoadingSpinner size={14} label="" /> : <GitBranch size={14} />}
          Explore
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 24 }}>
          <ErrorBanner
            message={error.message}
            code={error.code}
            onRetry={() => fetchGraph(packageName)}
          />
        </div>
      )}

      {loading && <PageLoader />}

      {!loading && graph && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
          {/* Graph */}
          <div>
            {/* Stats bar */}
            {stats && (
              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                {[
                  { label: "Packages", value: stats.total, color: "#000000" },
                  { label: "Dependencies", value: stats.links, color: "#000000" },
                  { label: "Deprecated", value: stats.deprecated, color: stats.deprecated > 0 ? "#ef4444" : "#475569" },
                ].map((s) => (
                  <div className="stat-card" key={s.label} style={{ flex: 1 }}>
                    <div className="stat-value" style={{ color: s.color, fontSize: 24 }}>{s.value}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <DependencyGraph
              data={graph}
              onNodeClick={(node) => setSelectedNode(node)}
              height={520}
            />
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {selectedNode ? (
              <div className="minimal-card" style={{ padding: "20px" }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{selectedNode.label}</div>
                <span
                  className={`badge badge-${selectedNode.type === "deprecated" ? "critical" : selectedNode.type === "root" ? "info" : "success"}`}
                  style={{ marginBottom: 14, display: "inline-block" }}
                >
                  {selectedNode.type}
                </span>
                {selectedNode.data.version !== undefined && (
                  <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
                    Version:{" "}
                    <span style={{ color: "#000000", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                      v{String(selectedNode.data.version)}
                    </span>
                  </div>
                )}
                {selectedNode.data.description !== undefined && (
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
                    {String(selectedNode.data.description)}
                  </div>
                )}
                {selectedNode.type === "deprecated" && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10, color: "#000000", fontSize: 12 }}>
                    <AlertTriangle size={12} />
                    This version is deprecated
                  </div>
                )}
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 12, width: "100%", justifyContent: "center" }}
                    onClick={() => router.push(`/explore?name=${encodeURIComponent(selectedNode.label)}`)}
                  >
                    <GitBranch size={12} /> Explore this package
                  </button>
                  <button
                    className="btn-danger"
                    style={{ fontSize: 12, width: "100%", justifyContent: "center" }}
                    onClick={() => router.push(`/blast-radius?name=${encodeURIComponent(selectedNode.label)}`)}
                  >
                    Blast Radius
                  </button>
                </div>
              </div>
            ) : (
              <div className="minimal-card" style={{ padding: 20 }}>
                <div style={{ color: "#374151", fontSize: 13, textAlign: "center" }}>
                  <Package size={28} style={{ margin: "0 auto 8px", color: "#111827" }} />
                  Click a node to inspect it
                </div>
              </div>
            )}

            {/* Node list */}
            <div className="minimal-card" style={{ padding: "16px 20px", flex: 1, overflow: "hidden" }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: "#4b5563" }}>
                PACKAGES ({graph.nodes.length})
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {graph.nodes.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: selectedNode?.id === node.id ? "rgba(0,0,0,0.1)" : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background:
                          node.type === "root"
                            ? "#6366f1"
                            : node.type === "deprecated"
                            ? "#ef4444"
                            : "#3b82f6",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: "#4b5563",
                        fontFamily: "var(--font-mono)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {node.label}
                    </span>
                    {node.type !== "root" && (
                      <ExternalLink size={10} color="#475569" style={{ flexShrink: 0, marginLeft: "auto" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !graph && !error && packageName && (
        <div className="minimal-card" style={{ padding: 48, textAlign: "center", color: "#374151" }}>
          <ChevronRight size={32} style={{ margin: "0 auto 12px", color: "#111827" }} />
          Enter a package name to begin
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ExploreContent />
    </Suspense>
  );
}
