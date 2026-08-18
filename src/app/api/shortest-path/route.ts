import { NextResponse } from "next/server";
import { getShortestPath } from "@/lib/queries";
import { AppError } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to parameters are required" }, { status: 400 });
  }

  try {
    const result = await getShortestPath(from, to);
    if (!result) {
      return NextResponse.json({ error: "No path found between these packages", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(result);
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
