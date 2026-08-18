"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitBranch, Zap, ArrowLeftRight, BarChart3, Home } from "lucide-react";

const navLinks = [
  { href: "/", label: "Search", icon: Home },
  { href: "/explore", label: "Explore", icon: GitBranch },
  { href: "/blast-radius", label: "Blast Radius", icon: Zap },
  { href: "/compare", label: "Compare", icon: ArrowLeftRight },
  { href: "/risk", label: "Risk Ranking", icon: BarChart3 },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        background: "rgba(10, 13, 20, 0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GitBranch size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.1 }}>
              Blast Radius
            </div>
            <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 500, letterSpacing: "0.05em" }}>
              NPM EXPLORER
            </div>
          </div>
        </Link>

        {/* Nav links */}
        <div style={{ display: "flex", gap: 4 }}>
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#f1f5f9" : "#94a3b8",
                  background: isActive ? "rgba(99,102,241,0.15)" : "transparent",
                  border: isActive ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Badge */}
        <div
          style={{
            fontSize: 11,
            color: "#10b981",
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: 9999,
            padding: "3px 10px",
            fontWeight: 600,
          }}
        >
          CognoDB
        </div>
      </div>
    </nav>
  );
}
