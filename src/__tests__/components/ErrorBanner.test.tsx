/**
 * __tests__/components/ErrorBanner.test.tsx
 * Tests for the ErrorBanner component.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBanner } from "@/components/ErrorBanner";

describe("ErrorBanner", () => {
  it("renders the error message", () => {
    render(<ErrorBanner message="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders generic error title when code is not DB_ERROR", () => {
    render(<ErrorBanner message="Query failed" code="QUERY_ERROR" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("renders 'Database Unreachable' title for DB_ERROR code", () => {
    render(<ErrorBanner message="Cannot connect" code="DB_ERROR" />);
    expect(screen.getByText("Database Unreachable")).toBeInTheDocument();
  });

  it("shows CognoDB-specific hint for DB_ERROR", () => {
    render(<ErrorBanner message="Cannot connect" code="DB_ERROR" />);
    expect(screen.getByText(/CognoDB instance/i)).toBeInTheDocument();
  });

  it("renders retry button when onRetry is provided", () => {
    const onRetry = jest.fn();
    render(<ErrorBanner message="Error" onRetry={onRetry} />);
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(<ErrorBanner message="Error" />);
    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = jest.fn();
    render(<ErrorBanner message="Error" onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("has role=alert for screen readers", () => {
    render(<ErrorBanner message="Error occurred" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("displays message text content accurately", () => {
    const longMsg = "Package 'xyz' was not found in the dependency graph. Try seeding first.";
    render(<ErrorBanner message={longMsg} />);
    expect(screen.getByText(longMsg)).toBeInTheDocument();
  });
});
