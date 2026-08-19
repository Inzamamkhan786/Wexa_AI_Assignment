"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { GraphData, GraphNode } from "@/lib/queries";
import type { ForceGraphMethods } from "react-force-graph-2d";

// Dynamically import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface DependencyGraphProps {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  highlightNodes?: Set<string>;
  height?: number;
}

const NODE_COLORS: Record<string, string> = {
  root: "#6366f1",
  package: "#3b82f6",
  deprecated: "#ef4444",
  target: "#f97316",
  vulnerability: "#ef4444",
};

const NODE_SIZES: Record<string, number> = {
  root: 10,
  package: 6,
  deprecated: 6,
  target: 9,
  vulnerability: 8,
};

export function DependencyGraph({
  data,
  onNodeClick,
  highlightNodes,
  height = 500,
}: DependencyGraphProps) {
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const getNodeColor = useCallback(
    (node: GraphNode) => {
      if (highlightNodes && !highlightNodes.has(node.id)) {
        return ""rgba(0,0,0,0.1)"";
      }
      return NODE_COLORS[node.type] ?? "#3b82f6";
    },
    [highlightNodes]
  );

  const getNodeSize = useCallback((node: GraphNode) => NODE_SIZES[node.type] ?? 6, []);

  const paintNode = useCallback(
    (node: Record<string, unknown>, ctx: CanvasRenderingContext2D) => {
      const gNode = node as unknown as GraphNode & { x?: number; y?: number };
      const x = gNode.x ?? 0;
      const y = gNode.y ?? 0;
      const size = getNodeSize(gNode);
      const color = getNodeColor(gNode);

      // Outer glow
      if (
        highlightNodes?.has(gNode.id) ||
        gNode.type === "root" ||
        gNode.type === "target"
      ) {
        ctx.beginPath();
        ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
        const glowColor = color.startsWith("rgba") ? color : color + "33";
        ctx.fillStyle = glowColor;
        ctx.fill();
      }

      // Main circle
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Label
      if (gNode.type === "root" || gNode.type === "target" || size >= 8) {
        ctx.fillStyle = "#f1f5f9";
        ctx.font = `bold ${gNode.type === "root" ? 11 : 9}px Inter, sans-serif`;
        ctx.textAlign = "center";
        const label = gNode.label.length > 14 ? gNode.label.slice(0, 14) + "…" : gNode.label;
        ctx.fillText(label, x, y + size + 12);
      }
    },
    [getNodeColor, getNodeSize, highlightNodes]
  );

  return (
    <div className="graph-container" style={{ height, position: "relative" }}>
      {/* Controls */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 10,
          display: "flex",
          gap: 6,
        }}
      >
        {[
          {
            icon: ZoomIn,
            title: "Zoom in",
            onClick: () => graphRef.current?.zoom(1.5, 300),
          },
          {
            icon: ZoomOut,
            title: "Zoom out",
            onClick: () => graphRef.current?.zoom(0.7, 300),
          },
          {
            icon: Maximize2,
            title: "Fit view",
            onClick: () => graphRef.current?.zoomToFit(400),
          },
        ].map(({ icon: Icon, title, onClick }) => (
          <button
            key={title}
            title={title}
            onClick={onClick}
            style={{
              background: "rgba(15,21,34,0.85)",
              border: "1px solid "rgba(0,0,0,0.1)"",
              borderRadius: 8,
              padding: 7,
              cursor: "pointer",
              color: "#4b5563",
              display: "flex",
              alignItems: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          zIndex: 10,
          background: "rgba(15,21,34,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: "8px 12px",
          backdropFilter: "blur(8px)",
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          maxWidth: 280,
        }}
      >
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 10, color: "#4b5563", textTransform: "capitalize" }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="tooltip"
          style={{
            position: "absolute",
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 10,
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 600, color: "#000000", marginBottom: 2 }}>{hoveredNode.label}</div>
          <div style={{ fontSize: 11, color: "#4b5563" }}>Type: {hoveredNode.type}</div>
          {hoveredNode.data?.version !== undefined && (
            <div style={{ fontSize: 11, color: "#4b5563" }}>v{String(hoveredNode.data.version)}</div>
          )}
        </div>
      )}

      <ForceGraph2D
        ref={graphRef}
        graphData={data as { nodes: object[]; links: object[] }}
        nodeId="id"
        nodeLabel=""
        height={height}
        backgroundColor="transparent"
        linkColor={() => "rgba(148,163,184,0.15)"}
        linkWidth={1}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => "replace"}
        onNodeClick={(node) => onNodeClick?.(node as unknown as GraphNode)}
        onNodeHover={(node, _prev) => {
          setHoveredNode(node ? (node as unknown as GraphNode) : null);
        }}
        onNodeDrag={(node, translate) => {
          const rect = (document.querySelector(".graph-container canvas") as HTMLElement)?.getBoundingClientRect();
          if (rect) {
            setTooltipPos({ x: translate.x - rect.left, y: translate.y - rect.top });
          }
        }}
        cooldownTicks={80}
        onEngineStop={() => graphRef.current?.zoomToFit(400)}
      />
    </div>
  );
}
