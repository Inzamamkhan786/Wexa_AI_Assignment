import { NextResponse } from "next/server";
import { getSharedDependencies } from "@/lib/queries";
import { AppError } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pkgA = searchParams.get("a");
  const pkgB = searchParams.get("b");

  if (!pkgA || !pkgB) {
    return NextResponse.json({ error: "Both a and b parameters are required" }, { status: 400 });
  }

  try {
    const results = await getSharedDependencies(pkgA, pkgB);
    return NextResponse.json(results);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Database unreachable. Please try again later.", code: "DB_ERROR" },
      { status: 503 }
    );
  }
}
