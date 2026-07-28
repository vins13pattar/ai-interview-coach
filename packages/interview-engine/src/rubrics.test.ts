import { InterviewRubricSchema } from "@interview-coach/contracts";
import { describe, expect, it } from "vitest";

import {
  interviewRubrics,
  resolveRoleFamily,
  RUBRIC_REGISTRY_VERSION,
} from "./rubrics";

describe("versioned role rubric registry", () => {
  it("contains the six required role families with unique versioned IDs", () => {
    expect(interviewRubrics).toHaveLength(6);
    expect(new Set(interviewRubrics.map((rubric) => rubric.id)).size).toBe(6);
    for (const rubric of interviewRubrics) {
      expect(InterviewRubricSchema.parse(rubric)).toEqual(rubric);
      expect(rubric.version).toBe(RUBRIC_REGISTRY_VERSION);
      expect(
        rubric.dimensions.some(
          (dimension) => dimension.dimension === "technicalDepth",
        ),
      ).toBe(true);
      expect(
        rubric.dimensions.some(
          (dimension) => dimension.dimension === "pronunciation",
        ),
      ).toBe(false);
    }
  });

  it.each([
    ["Frontend Engineer", "frontend-engineer"],
    ["Backend Engineer", "backend-engineer"],
    ["Full-Stack Engineer", "full-stack-engineer"],
    ["Technical Lead", "technical-lead"],
    ["Principal Engineer", "principal-engineer"],
    ["GenAI Engineer", "genai-engineer"],
  ] as const)("maps %s to %s", (role, expected) => {
    expect(resolveRoleFamily(role)).toBe(expected);
  });
});
