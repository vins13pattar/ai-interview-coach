import { describe, expect, it } from "vitest";

import {
  buildOpenAiRealtimeSessionRequest,
  parseOpenAiClientSecretResponse,
} from "./client-secret";

describe("OpenAI Realtime client secret contract", () => {
  it("builds semantic VAD without automatic interview responses", () => {
    const request = buildOpenAiRealtimeSessionRequest({
      model: "gpt-realtime-2.1",
      voice: "marin",
      role: "Platform Engineer",
      seniority: "Senior",
      focusAreas: ["system design"],
    });

    expect(request).toMatchObject({
      session: {
        model: "gpt-realtime-2.1",
        audio: {
          input: {
            turn_detection: {
              type: "semantic_vad",
              create_response: false,
              interrupt_response: true,
            },
          },
        },
      },
    });
  });

  it("normalizes the provider response and rejects malformed secrets", () => {
    expect(
      parseOpenAiClientSecretResponse({
        value: "ephemeral-fixture",
        expires_at: 1_800_000_000,
      }),
    ).toEqual({
      value: "ephemeral-fixture",
      expiresAt: 1_800_000_000,
    });
    expect(() => parseOpenAiClientSecretResponse({ value: "" })).toThrow();
  });
});
