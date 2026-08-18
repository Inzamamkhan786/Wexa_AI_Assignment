import { NextResponse } from "next/server";
import { searchPackages, getPackageInfo } from "@/lib/queries";
import { AppError } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const exact = searchParams.get("exact");

  try {
    if (exact) {
      const info = await getPackageInfo(exact);
      if (!info) {
        return NextResponse.json({ error: "Package not found" }, { status: 404 });
      }
      return NextResponse.json(info);
    }

    if (!query || query.trim().length < 1) {
      return NextResponse.json({ error: "Query parameter q is required" }, { status: 400 });
    }

    const results = await searchPackages(query.trim());
    return NextResponse.json(results);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === "NOT_FOUND" ? 404 : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json({ error: "Database unreachable. Please try again later.", code: "DB_ERROR" }, { status: 503 });
  }
}
