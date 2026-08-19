/**
 * __tests__/components/DependencyGraph.test.tsx
 * Tests for the DependencyGraph component.
 * react-force-graph-2d is mocked to a simple div.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DependencyGraph } from "@/components/DependencyGraph";
import type { GraphData, GraphNode } from "@/lib/queries";

const sampleData: GraphData = {
  nodes: [
    { id: "pkg:express", label: "express", type: "root", data: { version: "4.18.2" } },
    { id: "pkg:qs", label: "qs", type: "package", data: { version: "6.11.0" } },
    { id: "pkg:debug", label: "debug", type: "deprecated", data: {} },
  ],
  links: [
    { source: "pkg:express", target: "pkg:qs", type: "DEPENDS_ON", versionRange: "^6" },
    { source: "pkg:express", target: "pkg:debug", type: "DEPENDS_ON" },
  ],
};

describe("DependencyGraph", () => {
  it("renders without crashing", () => {
    expect(() => render(<DependencyGraph data={sampleData} />)).not.toThrow();
  });

  it("renders the force graph mock", () => {
    render(<DependencyGraph data={sampleData} />);
    expect(screen.getByTestId("force-graph")).toBeInTheDocument();
  });

  it("passes correct node count to graph", () => {
    render(<DependencyGraph data={sampleData} />);
    const graph = screen.getByTestId("force-graph");
    expect(graph.getAttribute("data-nodes")).toBe("3");
  });

  it("passes correct link count to graph", () => {
    render(<DependencyGraph data={sampleData} />);
    const graph = screen.getByTestId("force-graph");
    expect(graph.getAttribute("data-links")).toBe("2");
  });

  it("renders zoom control buttons", () => {
    render(<DependencyGraph data={sampleData} />);
    expect(screen.getByTitle("Zoom in")).toBeInTheDocument();
    expect(screen.getByTitle("Zoom out")).toBeInTheDocument();
    expect(screen.getByTitle("Fit view")).toBeInTheDocument();
  });

  it("renders the legend with node type labels", () => {
    render(<DependencyGraph data={sampleData} />);
    // Legend shows node type names
    expect(screen.getByText("root")).toBeInTheDocument();
    expect(screen.getByText("package")).toBeInTheDocument();
    expect(screen.getByText("deprecated")).toBeInTheDocument();
    expect(screen.getByText("target")).toBeInTheDocument();
  });

  it("renders with empty data without crashing", () => {
    const empty: GraphData = { nodes: [], links: [] };
    expect(() => render(<DependencyGraph data={empty} />)).not.toThrow();
  });

  it("accepts optional highlightNodes set", () => {
    const highlights = new Set(["pkg:express"]);
    expect(() =>
      render(<DependencyGraph data={sampleData} highlightNodes={highlights} />)
    ).not.toThrow();
  });

  it("accepts optional onNodeClick callback", () => {
    const onNodeClick = jest.fn();
    render(<DependencyGraph data={sampleData} onNodeClick={onNodeClick} />);
    // Callback is wired to the graph — just verify no crash on render
    expect(screen.getByTestId("force-graph")).toBeInTheDocument();
  });

  it("respects custom height prop", () => {
    const { container } = render(<DependencyGraph data={sampleData} height={300} />);
    const graphContainer = container.querySelector(".graph-container") as HTMLElement;
    expect(graphContainer.style.height).toBe("300px");
  });

  it("zoom buttons do not throw when clicked", () => {
    render(<DependencyGraph data={sampleData} />);
    expect(() => {
      fireEvent.click(screen.getByTitle("Zoom in"));
      fireEvent.click(screen.getByTitle("Zoom out"));
      fireEvent.click(screen.getByTitle("Fit view"));
    }).not.toThrow();
  });
});
