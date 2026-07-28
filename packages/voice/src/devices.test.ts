import { describe, expect, it } from "vitest";

import { classifyMediaError } from "./devices";

describe("voice device recovery", () => {
  it.each([
    ["NotAllowedError", "permission_denied"],
    ["NotFoundError", "device_missing"],
    ["OverconstrainedError", "device_missing"],
    ["NotReadableError", "device_busy"],
    ["UnknownError", "connection_failed"],
  ])("maps %s to %s", (name, expected) => {
    expect(classifyMediaError({ name }).code).toBe(expected);
  });
});
