/**
 * __tests__/components/LoadingStates.test.tsx
 * Tests for LoadingSpinner, LoadingSkeleton, and PageLoader.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  LoadingSpinner,
  LoadingSkeleton,
  PageLoader,
} from "@/components/LoadingStates";

describe("LoadingSpinner", () => {
  it("renders the default label", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders a custom label", () => {
    render(<LoadingSpinner label="Fetching graph…" />);
    expect(screen.getByText("Fetching graph…")).toBeInTheDocument();
  });

  it("renders without crashing when no props provided", () => {
    expect(() => render(<LoadingSpinner />)).not.toThrow();
  });
});

describe("LoadingSkeleton", () => {
  it("renders 3 skeleton rows by default", () => {
    const { container } = render(<LoadingSkeleton />);
    // Each skeleton div has className "skeleton"
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons).toHaveLength(3);
  });

  it("renders the specified number of rows", () => {
    const { container } = render(<LoadingSkeleton rows={5} />);
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons).toHaveLength(5);
  });

  it("renders 1 row when rows=1", () => {
    const { container } = render(<LoadingSkeleton rows={1} />);
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons).toHaveLength(1);
  });
});

describe("PageLoader", () => {
  it("renders the loading message", () => {
    render(<PageLoader />);
    expect(screen.getByText(/Loading graph data/i)).toBeInTheDocument();
  });

  it("renders without crashing", () => {
    expect(() => render(<PageLoader />)).not.toThrow();
  });
});
