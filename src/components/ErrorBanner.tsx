"use client";

import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  code?: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, code, onRetry }: ErrorBannerProps) {
  const isDbError = code === "DB_ERROR";

  return (
    <div
      style={{
        background: "rgba(239, 68, 68, 0.08)",
        border: "1px solid rgba(239, 68, 68, 0.25)",
        borderRadius: 14,
        padding: "16px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
      role="alert"
    >
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        {isDbError ? (
          <WifiOff size={20} color="#ef4444" />
        ) : (
          <AlertTriangle size={20} color="#ef4444" />
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#ef4444", marginBottom: 2 }}>
          {isDbError ? "Database Unreachable" : "Error"}
        </div>
        <div style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }}>{message}</div>
        {isDbError && (
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
            Check that your CognoDB instance is running and environment variables are configured.
          </div>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-secondary"
          style={{ padding: "6px 14px", fontSize: 13, flexShrink: 0 }}
        >
          <RefreshCw size={13} />
          Retry
        </button>
      )}
    </div>
  );
}
