import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "NPM Blast Radius Explorer | CognoDB Graph App",
  description:
    "Explore npm package dependency trees, find blast radius of vulnerabilities, trace shortest paths, and discover the riskiest packages in your dependency graph — powered by CognoDB graph database.",
  keywords: ["npm", "dependency graph", "vulnerability", "blast radius", "graph database", "CognoDB"],
  openGraph: {
    title: "NPM Blast Radius Explorer",
    description: "Graph-powered npm dependency analysis",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="animated-bg min-h-screen">
          <Navbar />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
