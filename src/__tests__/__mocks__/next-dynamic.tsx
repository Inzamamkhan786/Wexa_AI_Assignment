// Mock for next/dynamic
import React from "react";

const dynamic = (
  importFn: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
  _options?: { ssr?: boolean }
) => {
  // In tests, return a simple wrapper that renders the ForceGraph2D mock
  const LazyComponent = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      // Directly render our mock
      const MockGraph = require("./react-force-graph-2d").default;
      return <MockGraph {...props} ref={ref} />;
    }
  );
  LazyComponent.displayName = "DynamicComponent";
  return LazyComponent as unknown as React.ComponentType<Record<string, unknown>>;
};

export default dynamic;
