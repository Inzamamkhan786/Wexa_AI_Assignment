import { NextResponse } from "next/server";
import { getBlastRadius } from "@/lib/queries";
import { AppError } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const hops = parseInt(searchParams.get("hops") ?? "6", 10);

  if (!name) {
    return NextResponse.json({ error: "name parameter is required" }, { status: 400 });
  }

  try {
    const data = await getBlastRadius(name, hops);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === "NOT_FOUND" ? 404 : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json(
      { error: "Database unreachable. Please try again later.", code: "DB_ERROR" },
      { status: 503 }
    );
  }
}
