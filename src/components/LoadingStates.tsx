"use client";

export function LoadingSpinner({ size = 20, label = "Loading..." }: { size?: number; label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#4b5563" }}>
      <div
        style={{
          width: size,
          height: size,
          border: `2px solid rgba(0,0,0,0.1)`,
          borderTopColor: "#6366f1",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span style={{ fontSize: 14 }}>{label}</span>
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 56, opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: "3px solid rgba(0,0,0,0.1)",
          borderTopColor: "#6366f1",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ color: "#4b5563", fontSize: 14 }}>Loading graph data…</div>
    </div>
  );
}
