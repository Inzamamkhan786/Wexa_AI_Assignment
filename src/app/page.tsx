"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  GitBranch,
  Zap,
  ArrowLeftRight,
  BarChart3,
  ArrowRight,
  Package,
  Shield,
  Network,
} from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingStates";

const EXAMPLE_PACKAGES = ["express", "react", "next", "axios", "lodash", "webpack"];

const FEATURES = [
  {
    icon: GitBranch,
    color: "#6366f1",
    title: "Dependency Tree",
    desc: "Visualize multi-hop transitive dependencies as an interactive force graph",
  },
  {
    icon: Zap,
    color: "#ef4444",
    title: "Blast Radius",
    desc: "Given a vulnerable package, instantly see every app that's affected and through which path",
  },
  {
    icon: ArrowLeftRight,
    color: "#10b981",
    title: "Package Compare",
    desc: "Find shared dependencies between two packages and detect version conflicts",
  },
  {
    icon: BarChart3,
    color: "#f59e0b",
    title: "Risk Ranking",
    desc: 'Find the "riskiest" single package — the one whose compromise would affect the most code',
  },
];

interface SearchResult {
  name: string;
  description: string;
  homepage: string;
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(q: string = query) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch(`/api/packages?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError({ message: data.error, code: data.code });
        setResults([]);
      } else {
        setResults(data);
      }
    } catch {
      setError({ message: "Failed to connect to the server.", code: "DB_ERROR" });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 56 }} className="animate-fade-in-up">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.25)",
            borderRadius: 9999,
            padding: "6px 16px",
            marginBottom: 24,
          }}
        >
          <Network size={12} color="#6366f1" />
          <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 600, letterSpacing: "0.08em" }}>
            POWERED BY COGNODB GRAPH DATABASE
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 56px)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          <span className="gradient-text">NPM Blast Radius</span>
          <br />
          <span style={{ color: "#f1f5f9" }}>Explorer</span>
        </h1>

        <p
          style={{
            fontSize: 17,
            color: "#94a3b8",
            maxWidth: 560,
            margin: "0 auto 40px",
            lineHeight: 1.7,
          }}
        >
          Answer questions SQL can't: which packages are affected by a vulnerability, what's the
          shortest dependency path, and which package is the single biggest risk?
        </p>

        {/* Search box */}
        <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", gap: 10 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#475569",
                pointerEvents: "none",
              }}
            />
            <input
              id="package-search"
              className="input-primary"
              style={{ paddingLeft: 40 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search npm package (e.g. express, react…)"
              aria-label="Search npm package"
            />
          </div>
          <button
            id="search-btn"
            className="btn-primary"
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
          >
            {loading ? <LoadingSpinner size={15} label="" /> : <Search size={15} />}
            Search
          </button>
        </div>

        {/* Quick examples */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#475569" }}>Try:</span>
          {EXAMPLE_PACKAGES.map((pkg) => (
            <button
              key={pkg}
              onClick={() => {
                setQuery(pkg);
                handleSearch(pkg);
              }}
              style={{
                fontSize: 12,
                color: "#6366f1",
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 6,
                padding: "3px 10px",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                transition: "all 0.15s ease",
              }}
            >
              {pkg}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 24 }}>
          <ErrorBanner message={error.message} code={error.code} onRetry={() => handleSearch()} />
        </div>
      )}

      {/* Results */}
      {searched && !loading && !error && results.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            color: "#475569",
          }}
          className="glass-card"
        >
          <Package size={40} style={{ margin: "0 auto 12px", color: "#374151" }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#94a3b8" }}>
            No packages found
          </div>
          <div style={{ fontSize: 13 }}>
            "{query}" isn't in the graph yet. Try seeding more packages or searching for one of the
            examples above.
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 48 }}>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </div>
          {results.map((pkg) => (
            <div
              key={pkg.name}
              className="glass-card animate-fade-in-up"
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onClick={() => router.push(`/explore?name=${encodeURIComponent(pkg.name)}`)}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Package size={16} color="#6366f1" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#f1f5f9", marginBottom: 2 }}>
                  {pkg.name}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pkg.description || "No description"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/explore?name=${encodeURIComponent(pkg.name)}`);
                  }}
                >
                  <GitBranch size={12} /> Explore
                </button>
                <button
                  className="btn-danger"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/blast-radius?name=${encodeURIComponent(pkg.name)}`);
                  }}
                >
                  <Zap size={12} /> Blast Radius
                </button>
              </div>
              <ArrowRight size={16} color="#475569" />
            </div>
          ))}
        </div>
      )}

      {/* Feature cards */}
      {!searched && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 48 }}>
            {FEATURES.map(({ icon: Icon, color, title, desc }) => (
              <div
                key={title}
                className="glass-card animate-fade-in-up"
                style={{ padding: "24px 20px" }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    background: `${color}18`,
                    border: `1px solid ${color}30`,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 14,
                  }}
                >
                  <Icon size={20} color={color} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* "Why graph?" callout */}
          <div
            className="glass-card"
            style={{
              padding: "28px 32px",
              background: "rgba(99,102,241,0.05)",
              borderColor: "rgba(99,102,241,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Shield size={18} color="#6366f1" />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Why a graph database?</span>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.8, margin: 0 }}>
              Dependency resolution is inherently <strong style={{ color: "#f1f5f9" }}>recursive many-to-many</strong>. In
              SQL, answering "which root apps are transitively affected?" requires multi-level recursive CTEs
              that become slow and unreadable past 3 hops. In Cypher (CognoDB), it's a single traversal query.
              Blast-radius and shortest-path are <strong style={{ color: "#f1f5f9" }}>native graph operations</strong>,
              not workarounds.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
