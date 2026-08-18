import { NextResponse } from "next/server";
import { getRiskRanking } from "@/lib/queries";
import { AppError } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "15", 10);

  try {
    const data = await getRiskRanking(limit);
    return NextResponse.json(data);
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
