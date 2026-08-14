import { RecruiterReportRequestSchema } from "@interview-coach/contracts";
import { databaseConfigured } from "@interview-coach/database";
import { createRecruiterReport } from "@interview-coach/interview-engine";

import {
  apiError,
  assertMutationRequest,
  HttpError,
  MAX_REPORT_BODY_BYTES,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertMutationRequest(request);
    const payload = RecruiterReportRequestSchema.parse(
      await readJsonBody(request, MAX_REPORT_BODY_BYTES),
    );
    if (databaseConfigured()) {
      throw new HttpError(410, "Use the durable interview session API.");
    }
    return noStoreJson(createRecruiterReport(payload));
  } catch (error) {
    return apiError(error);
  }
}
