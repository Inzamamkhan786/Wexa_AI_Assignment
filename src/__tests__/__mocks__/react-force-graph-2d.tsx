// Mock for react-force-graph-2d — canvas not available in jsdom
import React from "react";

const ForceGraph2D = React.forwardRef(
  (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      zoom: jest.fn(),
      zoomToFit: jest.fn(),
    }));
    return (
      <div
        data-testid="force-graph"
        data-nodes={JSON.stringify((props.graphData as { nodes: unknown[] })?.nodes?.length ?? 0)}
        data-links={JSON.stringify((props.graphData as { links: unknown[] })?.links?.length ?? 0)}
      />
    );
  }
);

ForceGraph2D.displayName = "ForceGraph2D";
export default ForceGraph2D;
