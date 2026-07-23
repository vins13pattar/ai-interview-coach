import { RecruiterReportRequestSchema } from "@interview-coach/contracts";
import { createRecruiterReport } from "@interview-coach/interview-engine";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = RecruiterReportRequestSchema.parse(await request.json());
    return NextResponse.json(createRecruiterReport(payload), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid report request.", issues: error.issues },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: "The report could not be generated." },
      { status: 500 },
    );
  }
}
