import { RecruiterReportRequestSchema } from "@interview-coach/contracts";
import { createRecruiterReport } from "@interview-coach/interview-engine";

import {
  apiError,
  MAX_REPORT_BODY_BYTES,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = RecruiterReportRequestSchema.parse(
      await readJsonBody(request, MAX_REPORT_BODY_BYTES),
    );
    return noStoreJson(createRecruiterReport(payload));
  } catch (error) {
    return apiError(error);
  }
}
