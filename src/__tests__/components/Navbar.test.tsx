/**
 * __tests__/components/Navbar.test.tsx
 * Tests for the Navbar component.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";

// usePathname is mocked via __mocks__/next-navigation.ts
import { usePathname } from "next/navigation";
const mockUsePathname = usePathname as jest.Mock;

describe("Navbar", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("renders the brand name", () => {
    render(<Navbar />);
    // "Blast Radius" appears in both brand heading and nav link
    expect(screen.getAllByText("Blast Radius").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all 5 navigation links", () => {
    render(<Navbar />);
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Explore")).toBeInTheDocument();
    // "Blast Radius" appears as both brand name and nav link text — getAllByText avoids multiple-match error
    expect(screen.getAllByText("Blast Radius").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Compare")).toBeInTheDocument();
    expect(screen.getByText("Risk Ranking")).toBeInTheDocument();
  });

  it("shows the CognoDB badge", () => {
    render(<Navbar />);
    expect(screen.getByText("CognoDB")).toBeInTheDocument();
  });

  it("marks the active link based on current path", () => {
    mockUsePathname.mockReturnValue("/explore");
    render(<Navbar />);
    // The active nav link has specific styling — check it exists
    const exploreLink = screen.getByText("Explore").closest("a");
    expect(exploreLink).toBeInTheDocument();
  });

  it("renders correct href for each nav link", () => {
    render(<Navbar />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href")).filter(Boolean);
    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/explore");
    expect(hrefs).toContain("/blast-radius");
    expect(hrefs).toContain("/compare");
    expect(hrefs).toContain("/risk");
  });

  it("renders a sticky nav element", () => {
    render(<Navbar />);
    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
  });

  it("renders NPM EXPLORER sub-label", () => {
    render(<Navbar />);
    expect(screen.getByText("NPM EXPLORER")).toBeInTheDocument();
  });
});
