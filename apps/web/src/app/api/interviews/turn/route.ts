import { InterviewTurnSchema } from "@interview-coach/contracts";
import { runInterviewTurn } from "@interview-coach/interview-engine";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = InterviewTurnSchema.parse(await request.json());
    const requestKey = request.headers.get("x-provider-api-key") ?? undefined;
    const apiKey = requestKey;

    if (payload.provider !== "demo" && !apiKey) {
      return NextResponse.json(
        {
          error:
            "No provider key was supplied. Add a key in this browser tab or use demo mode.",
        },
        { status: 400 },
      );
    }

    const result = await runInterviewTurn(payload, apiKey);
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid interview turn.", issues: error.issues },
        { status: 422 },
      );
    }
    console.error("Interview turn failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "The interview evaluator could not complete this turn." },
      { status: 500 },
    );
  }
}
